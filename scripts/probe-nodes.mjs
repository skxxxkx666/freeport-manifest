import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";

export const defaultProbeTargets = [
  "https://cp.cloudflare.com",
  "https://www.gstatic.com/generate_204"
];

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const reservePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const mapConcurrent = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(concurrency, 1), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }
  );
  await Promise.all(runners);
  return results;
};

export const selectSpeedCandidates = (results, maximumAttempts = 8) => {
  const sorted = results
    .filter((result) => result.alive)
    .sort((a, b) => a.delayMs - b.delayMs);
  const selected = [];
  const remaining = [];
  const protocols = new Set();
  for (const result of sorted) {
    if (protocols.has(result.type)) {
      remaining.push(result);
    } else {
      protocols.add(result.type);
      selected.push(result);
    }
  }
  return [...selected, ...remaining].slice(
    0,
    Math.max(0, Math.floor(maximumAttempts))
  );
};

export const probeFailureReason = (message = "") => {
  const value = String(message).toLowerCase();
  if (/timeout|deadline exceeded|aborted/.test(value)) return "timeout";
  if (/no such host|lookup|dns/.test(value)) return "dns";
  if (/tls|certificate|handshake/.test(value)) return "tls-or-handshake";
  if (/refused/.test(value)) return "connection-refused";
  if (/unreachable|no route|network is down/.test(value)) {
    return "network-unreachable";
  }
  if (/reset|closed|eof/.test(value)) return "connection-closed";
  return "other";
};

export const parseEgressRegion = (trace = "") => {
  const region = String(trace).match(/^loc=([A-Z]{2})\s*$/m)?.[1];
  if (!region || ["EU", "UN", "XX", "ZZ"].includes(region)) return;
  return region;
};

const percentile = (values, ratio) => {
  if (!values.length) return null;
  const index = (values.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return Math.round(
    values[lower] + (values[upper] - values[lower]) * (index - lower)
  );
};

export function summarizeProbeResults(results, testedAt = new Date().toISOString()) {
  const healthy = results.filter((result) => result.alive);
  const delays = healthy
    .map((result) => result.delayMs)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const failureReasons = Object.fromEntries(
    [
      ...results
        .filter((result) => !result.alive)
        .reduce((counts, result) => {
          counts.set(result.reason, (counts.get(result.reason) ?? 0) + 1);
          return counts;
        }, new Map())
        .entries()
    ].sort()
  );

  return {
    testedAt,
    candidateCount: results.length,
    healthyCount: healthy.length,
    failedCount: results.length - healthy.length,
    aliveRatio: results.length ? healthy.length / results.length : 0,
    latencyMs: delays.length
      ? {
          min: delays[0],
          median: percentile(delays, 0.5),
          p95: percentile(delays, 0.95),
          max: delays.at(-1)
        }
      : null,
    failureReasons,
    results
  };
}

export function assertProbeThreshold(
  summary,
  { minimumHealthy = 5, minimumRatio = 0.2 } = {}
) {
  if (
    summary.healthyCount < minimumHealthy ||
    summary.aliveRatio < minimumRatio
  ) {
    throw new Error(
      `节点健康门槛未通过：${summary.healthyCount}/${summary.candidateCount}，` +
        `要求至少 ${minimumHealthy} 个且存活率不低于 ${Math.round(minimumRatio * 100)}%`
    );
  }
}

const probeConfig = (proxies, mixedPort) =>
  stringifyYaml(
    {
      "mixed-port": mixedPort,
      "allow-lan": false,
      mode: "rule",
      "log-level": "warning",
      ipv6: true,
      "unified-delay": true,
      "tcp-concurrent": true,
      proxies,
      "proxy-groups": [
        {
          name: "PROBE-SELECT",
          type: "select",
          proxies: proxies.map((proxy) => proxy.name)
        }
      ],
      rules: ["MATCH,PROBE-SELECT"]
    },
    { lineWidth: 0 }
  );

const apiRequest = async (
  controller,
  secret,
  path,
  { method = "GET", body, timeoutMs = 5000 } = {}
) => {
  const response = await fetch(`${controller}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${secret}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const waitForController = async (child, controller, secret, logs) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Mihomo 提前退出：${logs().slice(-2000)}`);
    }
    try {
      const { response } = await apiRequest(controller, secret, "/version", {
        timeoutMs: 1000
      });
      if (response.ok) return;
    } catch {
      // 等待控制端口开始监听。
    }
    await delay(250);
  }
  throw new Error(`Mihomo 控制端口未就绪：${logs().slice(-2000)}`);
};

const stopChild = async (child) => {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2000)
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
};

const testDelay = async (
  node,
  controller,
  secret,
  target,
  timeoutMs
) => {
  const query = new URLSearchParams({
    url: target,
    timeout: String(timeoutMs),
    expected: "204"
  });
  try {
    const { response, payload } = await apiRequest(
      controller,
      secret,
      `/proxies/${encodeURIComponent(node.name)}/delay?${query}`,
      { timeoutMs: timeoutMs + 3000 }
    );
    if (response.ok && Number.isFinite(payload.delay) && payload.delay > 0) {
      return {
        name: node.name,
        type: node.type,
        alive: true,
        delayMs: payload.delay,
        target
      };
    }
    return {
      name: node.name,
      type: node.type,
      alive: false,
      reason: probeFailureReason(payload.message || `HTTP ${response.status}`)
    };
  } catch (error) {
    return {
      name: node.name,
      type: node.type,
      alive: false,
      reason: probeFailureReason(error?.message || error)
    };
  }
};

const selectProxy = async (name, controller, secret) => {
  const selection = await apiRequest(
    controller,
    secret,
    `/proxies/${encodeURIComponent("PROBE-SELECT")}`,
    {
      method: "PUT",
      body: { name }
    }
  );
  if (!selection.response.ok) return false;
  await delay(100);
  return true;
};

const detectEgressRegion = async ({
  result,
  controller,
  secret,
  mixedPort,
  timeoutSeconds
}) => {
  result.regionDetectionStatus = "failed";
  if (!(await selectProxy(result.name, controller, secret))) {
    result.regionDetectionStatus = "selection-failed";
    return;
  }

  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const command = spawnSync(
    curl,
    [
      "--fail",
      "--silent",
      "--show-error",
      "--proxy",
      `http://127.0.0.1:${mixedPort}`,
      "--connect-timeout",
      String(Math.min(timeoutSeconds, 5)),
      "--max-time",
      String(timeoutSeconds),
      "https://www.cloudflare.com/cdn-cgi/trace"
    ],
    {
      encoding: "utf8",
      timeout: (timeoutSeconds + 5) * 1000,
      windowsHide: true
    }
  );
  if (command.error?.code === "ETIMEDOUT" || command.status === 28) {
    result.regionDetectionStatus = "timeout";
    return;
  }
  if (command.error || command.status !== 0) {
    result.regionDetectionStatus = "request-failed";
    return;
  }

  const region = parseEgressRegion(command.stdout);
  if (!region) {
    result.regionDetectionStatus = "invalid-response";
    return;
  }
  result.region = region;
  result.regionMethod = "egress";
  result.regionConfidence = "high";
  result.regionDetectionStatus = "ok";
};

const runSpeedSample = async ({
  result,
  controller,
  secret,
  mixedPort,
  bytes,
  timeoutSeconds
}) => {
  result.speedSampleStatus = "failed";
  result.speedSampleBytes = bytes;
  if (!(await selectProxy(result.name, controller, secret))) {
    result.speedSampleStatus = "selection-failed";
    return;
  }

  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  const sink = process.platform === "win32" ? "NUL" : "/dev/null";
  const command = spawnSync(
    curl,
    [
      "--silent",
      "--show-error",
      "--proxy",
      `http://127.0.0.1:${mixedPort}`,
      "--connect-timeout",
      "8",
      "--max-time",
      String(timeoutSeconds),
      "--output",
      sink,
      "--write-out",
      "%{http_code}\t%{size_download}\t%{speed_download}",
      `https://speed.cloudflare.com/__down?bytes=${bytes}`
    ],
    {
      encoding: "utf8",
      timeout: (timeoutSeconds + 5) * 1000,
      windowsHide: true
    }
  );
  if (command.error?.code === "ETIMEDOUT" || command.status === 28) {
    result.speedSampleStatus = "timeout";
    return;
  }
  if (command.error || command.status !== 0) {
    result.speedSampleStatus = "request-failed";
    return;
  }
  const [status, downloaded, bytesPerSecond] = String(command.stdout)
    .trim()
    .split("\t")
    .map(Number);
  if (status === 200 && downloaded === bytes && bytesPerSecond > 0) {
    result.speedMbps = Number(((bytesPerSecond * 8) / 1_000_000).toFixed(3));
    result.speedSampleStatus = "ok";
  } else if (Number.isFinite(status) && status > 0) {
    result.speedSampleStatus = "unexpected-response";
  }
};

export async function probeProxies(
  proxies,
  {
    mihomoBin = process.env.MIHOMO_BIN,
    targets = defaultProbeTargets,
    firstTimeoutMs = 8000,
    retryTimeoutMs = 12000,
    concurrency = 16,
    speedSampleSize = 3,
    speedSampleMaxAttempts = 8,
    speedSampleBytes = 250_000,
    speedTimeoutSeconds = 15,
    regionDetection = true,
    regionTimeoutSeconds = 5,
    regionMaximumLatencyMs = Number.POSITIVE_INFINITY
  } = {}
) {
  if (!mihomoBin) throw new Error("缺少 MIHOMO_BIN，无法执行发布前节点健康检查");
  if (!proxies.length) return summarizeProbeResults([]);

  const tempDirectory = await mkdtemp(join(tmpdir(), "freeport-probe-"));
  const configPath = join(tempDirectory, "config.yaml");
  const [controllerPort, mixedPort] = await Promise.all([
    reservePort(),
    reservePort()
  ]);
  const controller = `http://127.0.0.1:${controllerPort}`;
  const secret = randomBytes(24).toString("hex");
  await writeFile(configPath, probeConfig(proxies, mixedPort), "utf8");

  let output = "";
  let child;
  try {
    child = spawn(
      mihomoBin,
      [
        "-d",
        tempDirectory,
        "-f",
        configPath,
        "-ext-ctl",
        `127.0.0.1:${controllerPort}`,
        "-secret",
        secret
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 8000) output = output.slice(-8000);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
      if (output.length > 8000) output = output.slice(-8000);
    });
    await waitForController(child, controller, secret, () => output);

    const firstTarget = targets[0];
    const retryTarget = targets[1] ?? targets[0];
    const first = await mapConcurrent(proxies, concurrency, (proxy) =>
      testDelay(proxy, controller, secret, firstTarget, firstTimeoutMs)
    );
    const failed = first.filter((result) => !result.alive);
    const retries = await mapConcurrent(failed, concurrency, (result) =>
      testDelay(result, controller, secret, retryTarget, retryTimeoutMs)
    );
    const retryByName = new Map(retries.map((result) => [result.name, result]));
    const results = first.map((result) =>
      result.alive ? result : retryByName.get(result.name) ?? result
    );

    const speedCandidates = selectSpeedCandidates(
      results,
      speedSampleSize > 0 ? speedSampleMaxAttempts : 0
    );
    let successfulSpeedSamples = 0;
    for (const result of speedCandidates) {
      await runSpeedSample({
        result,
        controller,
        secret,
        mixedPort,
        bytes: speedSampleBytes,
        timeoutSeconds: speedTimeoutSeconds
      });
      if (result.speedSampleStatus === "ok") successfulSpeedSamples += 1;
      if (successfulSpeedSamples >= speedSampleSize) break;
    }

    if (regionDetection) {
      const healthy = results.filter(
        (result) => result.alive && result.delayMs <= regionMaximumLatencyMs
      );
      for (const result of healthy) {
        await detectEgressRegion({
          result,
          controller,
          secret,
          mixedPort,
          timeoutSeconds: regionTimeoutSeconds
        });
      }
      const detected = healthy.filter(
        (result) => result.regionDetectionStatus === "ok"
      ).length;
      console.log(`出口地区识别：${detected}/${healthy.length} 个存活节点`);
    }
    return summarizeProbeResults(results);
  } finally {
    if (child) await stopChild(child);
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
