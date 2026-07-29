// 拉取公开来源 → 解析/去重 → 生成真实订阅文件与每日运单。
// 默认来源在 config/sources.json；SOURCES 可追加公开或带鉴权的私有来源。

import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const tz = 8 * 60 * 60 * 1000;
const today = new Date(Date.now() + tz).toISOString().slice(0, 10);
const compact = today.replace(/-/g, "");
const shareProtocols = new Set(["vmess", "vless", "trojan", "ss"]);
const clashProtocols = new Set([...shareProtocols, "tuic"]);
const nodeUriPattern = /(?:vmess|vless|trojan|ss):\/\/[^\s"'<>[\]{}]+/gi;
const defaultTimeoutMs = 45_000;
const defaultSourcesPath = "config/sources.json";

const normalizeSource = (entry) => {
  const source = typeof entry === "string" ? { url: entry } : entry;
  if (!source || typeof source !== "object" || typeof source.url !== "string") return;

  const url = source.url.trim();
  try {
    const protocol = new URL(url).protocol;
    if (!["https:", "http:", "data:"].includes(protocol)) return;
  } catch {
    return;
  }

  const headers = {};
  if (source.headers && typeof source.headers === "object" && !Array.isArray(source.headers)) {
    for (const [name, value] of Object.entries(source.headers)) {
      if (["string", "number", "boolean"].includes(typeof value)) headers[name] = String(value);
    }
  }

  const normalized = { url, headers };
  if (typeof source.id === "string" && source.id.trim()) normalized.id = source.id.trim();
  if (typeof source.type === "string" && source.type.trim()) normalized.type = source.type.trim();
  if (source.enabled === false) normalized.enabled = false;
  if (source.allowRedistribution === true) normalized.allowRedistribution = true;
  if (Number.isInteger(source.maxItems) && source.maxItems > 0) {
    normalized.maxItems = Math.min(source.maxItems, 100);
  }
  return normalized;
};

export function parseSourceSpecs(input = "") {
  const raw = String(input).trim();
  if (!raw) return [];

  if (/^[{[]/.test(raw)) {
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.sources)
          ? parsed.sources
          : [parsed];
      return entries.map(normalizeSource).filter(Boolean);
    } catch {
      /* 兼容旧的空白分隔 URL 格式 */
    }
  }

  return raw.split(/\s+/).map(normalizeSource).filter(Boolean);
}

export async function loadSourceSpecs({
  configPath = process.env.SOURCES_FILE ?? defaultSourcesPath,
  envInput = process.env.SOURCES ?? ""
} = {}) {
  let configured = [];
  try {
    configured = parseSourceSpecs(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const merged = [...configured, ...parseSourceSpecs(envInput)];
  const seen = new Set();
  return merged.filter((source) => {
    const key = `${source.type ?? "auto"}\0${source.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const parseNodes = (text) => String(text).match(nodeUriPattern) ?? [];
export const dedupe = (items) => [...new Set(items)];

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const fingerprint = (value) =>
  createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 20);

const validClashProxy = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const protocol = String(value.type ?? "").toLowerCase();
  const name = String(value.name ?? "").trim();
  const port = Number(value.port);
  if (!clashProtocols.has(protocol) || !name || !value.server || !Number.isInteger(port)) return;
  return { ...value, type: protocol, name, port };
};

const clashNode = (value) => {
  const proxy = validClashProxy(value);
  if (!proxy) return;
  return `${proxy.type}://clash/${fingerprint(proxy)}#${encodeURIComponent(proxy.name)}`;
};

const decodeBase64 = (value, { strict = true } = {}) => {
  const compactValue = String(value).replace(/\s+/g, "");
  if (
    !compactValue ||
    compactValue.length % 4 === 1 ||
    !/^[A-Za-z0-9+/_-]+={0,2}$/.test(compactValue)
  ) {
    return;
  }
  if (strict && compactValue.length < 12) return;

  const normalized = compactValue.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = Buffer.from(padded, "base64");
  const roundTrip = decoded.toString("base64").replace(/=+$/, "");
  if (!decoded.length || roundTrip !== normalized || decoded.includes(0)) return;

  const text = decoded.toString("utf8");
  if (text.includes("\uFFFD")) return;
  return text;
};

const dedupeProxies = (proxies) => {
  const seen = new Set();
  return proxies.filter((proxy) => {
    const key = fingerprint(proxy);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mergePayload = (target, source) => {
  target.nodes.push(...source.nodes);
  target.proxies.push(...source.proxies);
};

const collectStructuredPayload = (value, payload, depth, seen = new WeakSet()) => {
  if (typeof value === "string") {
    payload.nodes.push(...parseNodes(value));
    if (depth < 2) {
      const decoded = decodeBase64(value);
      if (decoded) mergePayload(payload, parseSourcePayload(decoded, depth + 1));
    }
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectStructuredPayload(item, payload, depth, seen);
    return;
  }

  const proxy = validClashProxy(value);
  if (proxy) payload.proxies.push(proxy);
  for (const item of Object.values(value)) collectStructuredPayload(item, payload, depth, seen);
};

export function parseSourcePayload(text, depth = 0) {
  const body = String(text).replace(/^\uFEFF/, "").trim();
  if (!body) return { nodes: [], proxies: [] };

  const payload = { nodes: parseNodes(body), proxies: [] };
  try {
    const structured = /^[{[]/.test(body)
      ? JSON.parse(body)
      : parseYaml(body, { maxAliasCount: 100, prettyErrors: false });
    collectStructuredPayload(structured, payload, depth);
  } catch {
    /* 明文 URI 与 HTML 不要求结构化解析成功 */
  }

  if (depth < 2) {
    const decoded = decodeBase64(body);
    if (decoded) mergePayload(payload, parseSourcePayload(decoded, depth + 1));
  }
  return {
    nodes: dedupe(payload.nodes),
    proxies: dedupeProxies(payload.proxies)
  };
}

export function parseSourceBody(text, depth = 0) {
  const payload = parseSourcePayload(text, depth);
  return dedupe([...payload.nodes, ...payload.proxies.map(clashNode).filter(Boolean)]);
}

const sourceLabel = (source) => {
  if (source.id) return source.id;
  try {
    const url = new URL(source.url);
    return url.protocol === "data:" ? "data:fixture" : url.host;
  } catch {
    return "invalid-source";
  }
};

const requestText = async (source, fetchImpl, timeoutMs) => {
  const headers = new Headers({
    accept: "text/plain, text/html, application/json, application/yaml, text/yaml, */*",
    "user-agent": "freeport-manifest/1.0",
    ...source.headers
  });
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(source.url, {
        redirect: "follow",
        headers,
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        console.error(`来源 ${sourceLabel(source)} 首次请求失败，正在重试`);
      }
    }
  }
  throw lastError;
};

const decodeHtml = (value) =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");

export function parseV2NodesIndex(html, baseUrl) {
  const urls = [];
  const decoded = decodeHtml(html);
  for (const match of decoded.matchAll(/href=["']([^"']*\/servers\/\d+\/?)["']/gi)) {
    try {
      urls.push(new URL(match[1], baseUrl).href);
    } catch {
      /* 忽略无效详情链接 */
    }
  }
  return dedupe(urls);
}

export function parseV2NodesDetail(html) {
  const decoded = decodeHtml(html);
  const matches = decoded.match(/(?:vmess|vless|trojan|ss):\/\/[^<\r\n"]+/gi) ?? [];
  return dedupe(
    matches
      .map((node) => node.trim().replace(/\s+/g, (space) => "%20".repeat(space.length)))
      .filter((node) => {
        try {
          new URL(node);
          return true;
        } catch {
          return false;
        }
      })
  );
}

const fetchV2NodesCountry = async (source, options) => {
  if (!source.allowRedistribution) {
    console.error(
      `来源 ${sourceLabel(source)} 未启用：V2Nodes 条款要求先取得复制/分发授权`
    );
    return { nodes: [], proxies: [] };
  }

  const index = await requestText(source, options.fetchImpl, options.timeoutMs);
  const detailUrls = parseV2NodesIndex(index, source.url).slice(0, source.maxItems ?? 20);
  const nodes = [];
  for (const url of detailUrls) {
    try {
      const html = await requestText(
        { url, headers: source.headers },
        options.fetchImpl,
        options.timeoutMs
      );
      nodes.push(...parseV2NodesDetail(html));
    } catch (error) {
      console.error(`来源 ${sourceLabel(source)} 的详情页拉取失败 (${error.message})`);
    }
  }
  return { nodes: dedupe(nodes), proxies: [] };
};

export async function fetchSourcePayloads(
  sources,
  { fetchImpl = fetch, timeoutMs = defaultTimeoutMs } = {}
) {
  const payload = { nodes: [], proxies: [] };
  for (const source of sources) {
    if (source.enabled === false) continue;
    try {
      const current =
        source.type === "v2nodes-country"
          ? await fetchV2NodesCountry(source, { fetchImpl, timeoutMs })
          : parseSourcePayload(await requestText(source, fetchImpl, timeoutMs));
      mergePayload(payload, current);
      console.log(
        `来源 ${sourceLabel(source)}：${current.proxies.length} 个 Clash 节点，${current.nodes.length} 条分享链接`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UnknownError";
      console.error(`来源 ${sourceLabel(source)} 拉取失败 (${reason})`);
    }
  }
  return {
    nodes: dedupe(payload.nodes),
    proxies: dedupeProxies(payload.proxies)
  };
}

export async function fetchSources(
  input = process.env.SOURCES ?? "",
  { fetchImpl = fetch, timeoutMs = defaultTimeoutMs } = {}
) {
  const payload = await fetchSourcePayloads(parseSourceSpecs(input), { fetchImpl, timeoutMs });
  return dedupe([...payload.nodes, ...payload.proxies.map(clashNode).filter(Boolean)]);
}

const base64Url = (value) =>
  Buffer.from(String(value), "utf8").toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const proxyName = (proxy, fallback) => String(proxy.name ?? fallback).trim() || fallback;
const encodedFragment = (name) => `#${encodeURIComponent(name)}`;
const hostPort = (server, port) => `${String(server).includes(":") ? `[${server}]` : server}:${port}`;

const addNetworkParams = (params, proxy) => {
  const network = String(proxy.network ?? "tcp");
  params.set("type", network);
  if (network === "ws") {
    const options = proxy["ws-opts"] ?? {};
    if (options.path) params.set("path", String(options.path));
    const host = options.headers?.Host ?? options.headers?.host;
    if (host) params.set("host", String(host));
  }
  if (network === "grpc") {
    const serviceName = proxy["grpc-opts"]?.["grpc-service-name"];
    if (serviceName) params.set("serviceName", String(serviceName));
  }
};

export function clashProxyToUri(proxy) {
  const normalized = validClashProxy(proxy);
  if (!normalized || !shareProtocols.has(normalized.type)) return;
  const name = proxyName(normalized, `${normalized.type}-${normalized.server}`);

  if (normalized.type === "vmess") {
    if (!normalized.uuid) return;
    const network = String(normalized.network ?? "tcp");
    const ws = normalized["ws-opts"] ?? {};
    const grpc = normalized["grpc-opts"] ?? {};
    const payload = {
      v: "2",
      ps: name,
      add: String(normalized.server),
      port: String(normalized.port),
      id: String(normalized.uuid),
      aid: String(normalized.alterId ?? 0),
      scy: String(normalized.cipher ?? "auto"),
      net: network,
      type: "none",
      host: String(ws.headers?.Host ?? ws.headers?.host ?? ""),
      path: String(ws.path ?? grpc["grpc-service-name"] ?? ""),
      tls: normalized.tls ? "tls" : "",
      sni: String(normalized.servername ?? normalized.sni ?? "")
    };
    return `vmess://${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
  }

  if (normalized.type === "ss") {
    if (!normalized.cipher || normalized.password === undefined) return;
    const userInfo = base64Url(`${normalized.cipher}:${normalized.password}`);
    return `ss://${userInfo}@${hostPort(normalized.server, normalized.port)}${encodedFragment(name)}`;
  }

  const params = new URLSearchParams();
  addNetworkParams(params, normalized);
  const sni = normalized.servername ?? normalized.sni;
  if (sni) params.set("sni", String(sni));
  if (normalized["client-fingerprint"]) {
    params.set("fp", String(normalized["client-fingerprint"]));
  }

  if (normalized.type === "vless") {
    if (!normalized.uuid) return;
    params.set("encryption", "none");
    if (normalized.flow) params.set("flow", String(normalized.flow));
    const reality = normalized["reality-opts"];
    params.set("security", reality ? "reality" : normalized.tls ? "tls" : "none");
    if (reality?.["public-key"]) params.set("pbk", String(reality["public-key"]));
    if (reality?.["short-id"]) params.set("sid", String(reality["short-id"]));
    return `vless://${encodeURIComponent(normalized.uuid)}@${hostPort(normalized.server, normalized.port)}?${params}${encodedFragment(name)}`;
  }

  if (normalized.password === undefined) return;
  params.set("security", normalized.tls === false ? "none" : "tls");
  return `trojan://${encodeURIComponent(normalized.password)}@${hostPort(normalized.server, normalized.port)}?${params}${encodedFragment(name)}`;
}

const shareName = (url, fallback) => {
  try {
    return decodeURIComponent(url.hash.slice(1)) || fallback;
  } catch {
    return fallback;
  }
};

const applyNetworkOptions = (proxy, params) => {
  const network = params.get("type") || "tcp";
  proxy.network = network;
  if (network === "ws") {
    const headers = {};
    if (params.get("host")) headers.Host = params.get("host");
    proxy["ws-opts"] = {
      ...(params.get("path") ? { path: params.get("path") } : {}),
      ...(Object.keys(headers).length ? { headers } : {})
    };
  }
  if (network === "grpc" && params.get("serviceName")) {
    proxy["grpc-opts"] = { "grpc-service-name": params.get("serviceName") };
  }
};

export function nodeUriToClashProxy(node, index = 1) {
  const protocol = String(node).slice(0, String(node).indexOf(":")).toLowerCase();
  if (!shareProtocols.has(protocol)) return;

  if (protocol === "vmess") {
    const encoded = String(node).slice("vmess://".length).split("#")[0];
    const decoded = decodeBase64(encoded, { strict: false });
    if (!decoded) return;
    try {
      const value = JSON.parse(decoded);
      const proxy = {
        name: String(value.ps || `vmess-${index}`),
        type: "vmess",
        server: String(value.add),
        port: Number(value.port),
        uuid: String(value.id),
        alterId: Number(value.aid ?? 0),
        cipher: String(value.scy || "auto"),
        udp: true
      };
      if (value.net && value.net !== "tcp") proxy.network = String(value.net);
      if (value.tls) {
        proxy.tls = true;
        if (value.sni) proxy.servername = String(value.sni);
      }
      if (value.net === "ws") {
        proxy["ws-opts"] = {
          ...(value.path ? { path: String(value.path) } : {}),
          ...(value.host ? { headers: { Host: String(value.host) } } : {})
        };
      }
      if (value.net === "grpc" && value.path) {
        proxy["grpc-opts"] = { "grpc-service-name": String(value.path) };
      }
      return validClashProxy(proxy);
    } catch {
      return;
    }
  }

  if (protocol === "ss") {
    const raw = String(node).slice("ss://".length);
    const fragmentIndex = raw.indexOf("#");
    const withoutFragment = fragmentIndex >= 0 ? raw.slice(0, fragmentIndex) : raw;
    const name =
      fragmentIndex >= 0
        ? decodeURIComponent(raw.slice(fragmentIndex + 1))
        : `ss-${index}`;
    const queryIndex = withoutFragment.indexOf("?");
    const authority = queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
    if (!authority.includes("@")) {
      const decoded = decodeBase64(authority, { strict: false });
      return decoded ? nodeUriToClashProxy(`ss://${decoded}${encodedFragment(name)}`, index) : undefined;
    }
    const splitAt = authority.lastIndexOf("@");
    const encodedUser = authority.slice(0, splitAt);
    const endpoint = authority.slice(splitAt + 1);
    const user = decodeBase64(encodedUser, { strict: false });
    if (!user) return;
    const separator = user.indexOf(":");
    const endpointUrl = new URL(`http://${endpoint}`);
    return validClashProxy({
      name,
      type: "ss",
      server: endpointUrl.hostname,
      port: Number(endpointUrl.port),
      cipher: user.slice(0, separator),
      password: user.slice(separator + 1),
      udp: true
    });
  }

  try {
    const url = new URL(String(node).replace(/ /g, "%20"));
    const params = url.searchParams;
    const proxy = {
      name: shareName(url, `${protocol}-${index}`),
      type: protocol,
      server: url.hostname,
      port: Number(url.port),
      udp: true
    };
    applyNetworkOptions(proxy, params);
    const security = params.get("security");
    if (security === "tls" || security === "reality") proxy.tls = true;
    if (params.get("sni")) proxy.servername = params.get("sni");
    if (params.get("fp")) proxy["client-fingerprint"] = params.get("fp");

    if (protocol === "vless") {
      proxy.uuid = decodeURIComponent(url.username);
      if (params.get("flow")) proxy.flow = params.get("flow");
      if (security === "reality") {
        proxy["reality-opts"] = {
          ...(params.get("pbk") ? { "public-key": params.get("pbk") } : {}),
          ...(params.get("sid") ? { "short-id": params.get("sid") } : {})
        };
      }
    } else {
      proxy.password = decodeURIComponent(url.username);
    }
    return validClashProxy(proxy);
  } catch {
    return;
  }
}

const uniqueProxyNames = (proxies) => {
  const names = new Map();
  return proxies.map((proxy) => {
    const count = (names.get(proxy.name) ?? 0) + 1;
    names.set(proxy.name, count);
    return count === 1 ? proxy : { ...proxy, name: `${proxy.name} · ${count}` };
  });
};

export function buildSubscriptionPayload(payload) {
  const converted = payload.nodes
    .map((node, index) => nodeUriToClashProxy(node, index + 1))
    .filter(Boolean);
  const proxies = uniqueProxyNames(dedupeProxies([...payload.proxies, ...converted]));
  const shareUris = dedupe([
    ...payload.nodes,
    ...payload.proxies.map(clashProxyToUri).filter(Boolean)
  ]);
  return { proxies, shareUris };
}

export function renderClashConfig(proxies) {
  const names = proxies.map((proxy) => proxy.name);
  return stringifyYaml(
    {
      "mixed-port": 7890,
      "allow-lan": false,
      mode: "rule",
      "log-level": "info",
      ipv6: true,
      "unified-delay": true,
      "tcp-concurrent": true,
      profile: {
        "store-selected": true,
        "store-fake-ip": true
      },
      proxies,
      "proxy-groups": [
        {
          name: "🚢 FREEPORT",
          type: "select",
          proxies: ["♻️ AUTO", "DIRECT", ...names]
        },
        {
          name: "♻️ AUTO",
          type: "url-test",
          url: "https://www.gstatic.com/generate_204",
          interval: 300,
          tolerance: 80,
          proxies: names
        }
      ],
      rules: ["MATCH,🚢 FREEPORT"]
    },
    { lineWidth: 0 }
  );
}

export const protoOf = (node) => node.slice(0, node.indexOf(":"));

export const regionOf = (node) => {
  let tag = node.split("#")[1] ?? "";
  try {
    tag = decodeURIComponent(tag);
  } catch {
    /* 保留原始标签，避免单个错误转义中断整批签发 */
  }
  if (/香港|HK|Hong/i.test(tag)) return "HK";
  if (/日本|JP|Japan/i.test(tag)) return "JP";
  if (/新加坡|SG|Singapore/i.test(tag)) return "SG";
  if (/美国|US|United/i.test(tag)) return "US";
  return "OTHER";
};

const publicSubscriptionUrl = (fileName, env = process.env) => {
  const site = String(env.SUB_PUBLIC_BASE_URL || env.SITE_URL || "https://manifest.dpdns.org")
    .trim()
    .replace(/\/+$/, "");
  const base = String(env.BASE_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
  const path = `${base ? `/${base}` : ""}/free/${compact}/${fileName}`;
  return new URL(path, `${site}/`).href;
};

const writeIfChanged = async (path, content) => {
  let previous;
  try {
    previous = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (previous === content) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
};

const setChangedOutput = (changed) => {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
};

async function main() {
  const sources = await loadSourceSpecs();
  const fetched = await fetchSourcePayloads(sources);
  const { proxies, shareUris } = buildSubscriptionPayload(fetched);
  if (!proxies.length || !shareUris.length) {
    console.error("没有拉到可签发的 Clash 与 V2Ray 节点，今日不签发");
    setChangedOutput(false);
    return;
  }

  const artifactDir = `public/free/${compact}`;
  const artifactNodes = proxies.map(clashNode).filter(Boolean);
  const counts = new Map();
  for (const node of artifactNodes) {
    const key = `${regionOf(node)}|${protoOf(node)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const breakdown = [...counts.entries()]
    .map(([key, count]) => {
      const [region, protocol] = key.split("|");
      return { region, protocol, count };
    })
    .filter((item) => item.region !== "OTHER")
    .sort((a, b) => b.count - a.count);

  const regions = [...new Set(breakdown.map((item) => item.region))];
  const protocolList = [...new Set(proxies.map((proxy) => proxy.type))];
  const breakdownBlock = breakdown.length
    ? `breakdown:\n${breakdown
        .map(
          (item) =>
            `  - { region: "${item.region}", protocol: "${item.protocol}", count: ${item.count} }`
        )
        .join("\n")}\n`
    : "";
  const frontmatter = `---
date: ${today}
serial: "01"
issuedAt: "${today}T04:00:00+08:00"
clash: "${publicSubscriptionUrl("clash.yaml")}"
v2ray: "${publicSubscriptionUrl("v2ray.txt")}"
nodeCount: ${proxies.length}
regions: ${JSON.stringify(regions)}
protocols: ${JSON.stringify(protocolList)}
${breakdownBlock}expired: false
---
`;

  const changes = await Promise.all([
    writeIfChanged(`${artifactDir}/clash.yaml`, renderClashConfig(proxies)),
    writeIfChanged(
      `${artifactDir}/v2ray.txt`,
      `${Buffer.from(`${shareUris.join("\n")}\n`, "utf8").toString("base64")}\n`
    ),
    writeIfChanged(`src/content/subs/${today}.md`, frontmatter)
  ]);
  const changed = changes.some(Boolean);
  setChangedOutput(changed);
  console.log(
    `签发 FP-${compact}-01 —— Clash ${proxies.length} 件，V2Ray ${shareUris.length} 件${changed ? "" : "（无变化）"}`
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
