// 拉取公开来源 → 解析/去重 → 生成真实订阅文件与每日运单。
// 默认来源在 config/sources.json；SOURCES 可追加公开或带鉴权的私有来源。

import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  assertProbeThreshold,
  probeProxies,
  summarizeProbeResults
} from "./probe-nodes.mjs";

const tz = 8 * 60 * 60 * 1000;
const today = new Date(Date.now() + tz).toISOString().slice(0, 10);
const compact = today.replace(/-/g, "");
const shareProtocols = new Set(["vmess", "vless", "trojan", "ss"]);
const clashProtocols = new Set([...shareProtocols, "tuic"]);
const nodeUriPattern = /(?:vmess|vless|trojan|ss):\/\/[^\s"'<>[\]{}]+/gi;
const defaultTimeoutMs = 45_000;
const defaultMaxResponseBytes = 5_000_000;
const defaultSourcesPath = "config/sources.json";
const defaultCandidateLimit = 200;
const defaultPublishedLimit = 120;
const defaultMaxLatencyMs = 2500;

const normalizeRegionCode = (value) => {
  const rawRegion = String(value ?? "").trim().toUpperCase();
  const region = rawRegion === "UK" ? "GB" : rawRegion;
  if (!/^[A-Z]{2}$/.test(region) || ["EU", "UN", "XX", "ZZ"].includes(region)) {
    return;
  }
  return region;
};

const inferSourceRegion = (url) => {
  try {
    const match = new URL(url).pathname.match(
      /\/(?:subscriptions\/)?country\/([a-z]{2})(?:\/|$)/i
    );
    return normalizeRegionCode(match?.[1]);
  } catch {
    return;
  }
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim().length > 0;

const hasRequiredProtocolFields = (value, protocol) => {
  if (["vmess", "vless", "tuic"].includes(protocol) && !hasValue(value.uuid)) {
    return false;
  }
  if (["trojan", "tuic"].includes(protocol) && !hasValue(value.password)) {
    return false;
  }
  if (protocol === "ss" && (!hasValue(value.cipher) || !hasValue(value.password))) {
    return false;
  }

  const reality = value["reality-opts"];
  if (reality !== undefined && reality !== null) {
    return (
      protocol === "vless" &&
      typeof reality === "object" &&
      !Array.isArray(reality) &&
      hasValue(reality["public-key"])
    );
  }
  return true;
};

const normalizeSource = (entry) => {
  const source = typeof entry === "string" ? { url: entry } : entry;
  if (!source || typeof source !== "object" || typeof source.url !== "string") return;

  const url = source.url.trim();
  try {
    const protocol = new URL(url).protocol;
    if (!["https:", "data:"].includes(protocol)) return;
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
  const region = normalizeRegionCode(source.region) ?? inferSourceRegion(url);
  if (region) normalized.region = region;
  if (source.enabled === false) normalized.enabled = false;
  if (source.allowRedistribution === true) normalized.allowRedistribution = true;
  if (typeof source.license === "string" && source.license.trim()) {
    normalized.license = source.license.trim();
  }
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

export const proxyFingerprint = (value) => {
  const normalized = { ...value };
  delete normalized.name;
  return fingerprint(normalized);
};

const unsafeIpv4 = (address) => {
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && [18, 19].includes(b)) ||
    a >= 224
  );
};

const unsafeIpv6 = (address) => {
  const value = address.toLowerCase();
  return (
    value === "::" ||
    value === "::1" ||
    /^f[cd]/.test(value) ||
    /^fe[89ab]/.test(value) ||
    /^ff/.test(value) ||
    value.startsWith("2001:db8:")
  );
};

export const safeProxyServer = (server) => {
  const value = String(server ?? "").trim();
  if (
    !value ||
    value.length > 253 ||
    /[\s/@]/.test(value) ||
    /(^|\.)(localhost|local|lan|home\.arpa)$/i.test(value)
  ) {
    return false;
  }
  const family = isIP(value);
  if (family === 4) return !unsafeIpv4(value);
  if (family === 6) return !unsafeIpv6(value);
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
    value
  );
};

const validClashProxy = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const protocol = String(value.type ?? "").toLowerCase();
  const name = String(value.name ?? "").trim();
  const port = Number(value.port);
  if (
    !clashProtocols.has(protocol) ||
    !name ||
    name.length > 180 ||
    !safeProxyServer(value.server) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !hasRequiredProtocolFields(value, protocol) ||
    value["dialer-proxy"] ||
    value["interface-name"] ||
    value["routing-mark"]
  ) {
    return;
  }
  return {
    ...value,
    type: protocol,
    name,
    server: String(value.server).trim(),
    port
  };
};

const clashNode = (value) => {
  const proxy = validClashProxy(value);
  if (!proxy) return;
  return `${proxy.type}://clash/${proxyFingerprint(proxy)}#${encodeURIComponent(proxy.name)}`;
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
    const key = proxyFingerprint(proxy);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mergePayload = (target, source) => {
  target.nodes.push(...source.nodes);
  target.proxies.push(...source.proxies);
};

export const limitSourcePayload = (payload, maximumItems) => {
  const limit = Number.isInteger(maximumItems) && maximumItems > 0
    ? maximumItems
    : Number.POSITIVE_INFINITY;
  const selected = { nodes: [], proxies: [], ...(payload.meta ? { meta: payload.meta } : {}) };
  let nodeIndex = 0;
  let proxyIndex = 0;
  while (
    selected.nodes.length + selected.proxies.length < limit &&
    (nodeIndex < payload.nodes.length || proxyIndex < payload.proxies.length)
  ) {
    if (
      proxyIndex < payload.proxies.length &&
      selected.nodes.length + selected.proxies.length < limit
    ) {
      selected.proxies.push(payload.proxies[proxyIndex]);
      proxyIndex += 1;
    }
    if (
      nodeIndex < payload.nodes.length &&
      selected.nodes.length + selected.proxies.length < limit
    ) {
      selected.nodes.push(payload.nodes[nodeIndex]);
      nodeIndex += 1;
    }
  }
  return selected;
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

const readResponseText = async (response, maxBytes) => {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new Error(`响应超过 ${maxBytes} 字节限制`);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`响应超过 ${maxBytes} 字节限制`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
};

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

const requestText = async (
  source,
  fetchImpl,
  timeoutMs,
  maxBytes = defaultMaxResponseBytes
) => {
  const headers = new Headers({
    accept: "text/plain, text/html, application/json, application/yaml, text/yaml, */*",
    "user-agent": "freeport-manifest/1.0",
    ...source.headers
  });
  const hasPrivateHeaders = Object.keys(source.headers ?? {}).length > 0;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      let currentUrl = source.url;
      for (let redirect = 0; redirect <= 5; redirect += 1) {
        const response = await fetchImpl(currentUrl, {
          redirect: "manual",
          headers,
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (redirectStatuses.has(response.status) && response.headers.get("location")) {
          if (redirect === 5) throw new Error("重定向次数超过 5 次");
          const nextUrl = new URL(response.headers.get("location"), currentUrl);
          if (nextUrl.protocol !== "https:") {
            throw new Error("来源重定向必须保持 HTTPS");
          }
          if (
            hasPrivateHeaders &&
            nextUrl.origin !== new URL(currentUrl).origin
          ) {
            throw new Error("带鉴权来源不允许跨源重定向");
          }
          await response.body?.cancel();
          currentUrl = nextUrl.href;
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return readResponseText(response, maxBytes);
      }
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

const fetchV2NodesCountry = async (source, options) => {
  if (!source.allowRedistribution) {
    console.error(
      `来源 ${sourceLabel(source)} 未启用：V2Nodes 条款要求先取得复制/分发授权`
    );
    return { nodes: [], proxies: [] };
  }

  const index = await requestText(source, options.fetchImpl, options.timeoutMs);
  const detailUrls = parseV2NodesIndex(index, source.url).slice(0, source.maxItems ?? 20);
  let detailFailures = 0;
  const pages = await mapConcurrent(detailUrls, 4, async (url) => {
    try {
      const html = await requestText(
        { url, headers: source.headers },
        options.fetchImpl,
        options.timeoutMs
      );
      return parseV2NodesDetail(html);
    } catch (error) {
      detailFailures += 1;
      console.error(`来源 ${sourceLabel(source)} 的详情页拉取失败 (${error.message})`);
      return [];
    }
  });
  return {
    nodes: dedupe(pages.flat()),
    proxies: [],
    meta: {
      detailTotal: detailUrls.length,
      detailFailures
    }
  };
};

export async function fetchSourcePayloads(
  sources,
  { fetchImpl = fetch, timeoutMs = defaultTimeoutMs } = {}
) {
  const payload = { nodes: [], proxies: [] };
  const reports = [];
  for (const source of sources) {
    if (source.enabled === false) continue;
    const id = sourceLabel(source);
    try {
      const discovered =
        source.type === "v2nodes-country"
          ? await fetchV2NodesCountry(source, { fetchImpl, timeoutMs })
          : parseSourcePayload(await requestText(source, fetchImpl, timeoutMs));
      const current = limitSourcePayload(discovered, source.maxItems);
      mergePayload(payload, current);
      reports.push({
        id,
        status: current.meta?.detailFailures ? "partial" : "ok",
        nodeCount: current.nodes.length,
        proxyCount: current.proxies.length,
        discoveredNodeCount: discovered.nodes.length,
        discoveredProxyCount: discovered.proxies.length,
        maxItems: source.maxItems,
        region: source.region,
        license: source.license,
        detailTotal: current.meta?.detailTotal,
        detailFailures: current.meta?.detailFailures,
        payload: {
          nodes: current.nodes,
          proxies: current.proxies
        }
      });
      console.log(
        `来源 ${id}：采用 ${current.proxies.length} 个 Clash 节点、${current.nodes.length} 条分享链接` +
          (source.maxItems
            ? `（发现 ${discovered.proxies.length + discovered.nodes.length}，上限 ${source.maxItems}）`
            : "")
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UnknownError";
      reports.push({
        id,
        status: "failed",
        region: source.region,
        nodeCount: 0,
        proxyCount: 0,
        reason
      });
      console.error(`来源 ${id} 拉取失败 (${reason})`);
    }
  }
  return {
    nodes: dedupe(payload.nodes),
    proxies: dedupeProxies(payload.proxies),
    reports
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

const networkOptionsSupported = (proxy) => {
  const network = String(proxy.network ?? "tcp");
  if (!["tcp", "ws", "grpc"].includes(network)) return false;
  if (network === "ws") {
    const options = proxy["ws-opts"] ?? {};
    if (
      Object.keys(options).some((name) => !["path", "headers"].includes(name))
    ) {
      return false;
    }
    if (
      Object.keys(options.headers ?? {}).some(
        (name) => name.toLowerCase() !== "host"
      )
    ) {
      return false;
    }
  }
  if (
    network === "grpc" &&
    Object.keys(proxy["grpc-opts"] ?? {}).some(
      (name) => name !== "grpc-service-name"
    )
  ) {
    return false;
  }
  return true;
};

const addNetworkParams = (params, proxy) => {
  if (!networkOptionsSupported(proxy)) return false;
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
  return true;
};

export function clashProxyToUri(proxy) {
  const normalized = validClashProxy(proxy);
  if (!normalized || !shareProtocols.has(normalized.type)) return;
  const name = proxyName(normalized, `${normalized.type}-${normalized.server}`);

  if (normalized.type === "vmess") {
    if (!normalized.uuid) return;
    if (!networkOptionsSupported(normalized)) return;
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
      sni: String(normalized.servername ?? normalized.sni ?? ""),
      alpn: Array.isArray(normalized.alpn) ? normalized.alpn.join(",") : "",
      fp: String(normalized["client-fingerprint"] ?? ""),
      allowInsecure: normalized["skip-cert-verify"] ? "1" : ""
    };
    return `vmess://${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
  }

  if (normalized.type === "ss") {
    if (!normalized.cipher || normalized.password === undefined) return;
    if (normalized.plugin || normalized["plugin-opts"]) return;
    const userInfo = base64Url(`${normalized.cipher}:${normalized.password}`);
    return `ss://${userInfo}@${hostPort(normalized.server, normalized.port)}${encodedFragment(name)}`;
  }

  const params = new URLSearchParams();
  if (!addNetworkParams(params, normalized)) return;
  const sni = normalized.servername ?? normalized.sni;
  if (sni) params.set("sni", String(sni));
  if (normalized["client-fingerprint"]) {
    params.set("fp", String(normalized["client-fingerprint"]));
  }
  if (Array.isArray(normalized.alpn) && normalized.alpn.length) {
    params.set("alpn", normalized.alpn.join(","));
  }
  if (normalized["skip-cert-verify"] === true) {
    params.set("allowInsecure", "1");
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
      if (value.allowInsecure === true || value.allowInsecure === "1") {
        proxy["skip-cert-verify"] = true;
      }
      if (value.fp) proxy["client-fingerprint"] = String(value.fp);
      if (value.alpn) {
        proxy.alpn = String(value.alpn).split(",").filter(Boolean);
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
    if (["1", "true"].includes(String(params.get("allowInsecure")).toLowerCase())) {
      proxy["skip-cert-verify"] = true;
    }
    if (params.get("alpn")) {
      proxy.alpn = params.get("alpn").split(",").filter(Boolean);
    }

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

const reservedProxyNames = new Set([
  "DIRECT",
  "REJECT",
  "REJECT-DROP",
  "PASS",
  "COMPATIBLE",
  "🚢 FREEPORT",
  "♻️ AUTO",
  "🛟 FALLBACK",
  "💬 TELEGRAM",
  "🛡️ ADS",
  "🇭🇰 香港",
  "🇸🇬 新加坡",
  "🇯🇵 日本",
  "🇹🇼 台湾",
  "🇺🇸 美国",
  "🇪🇺 欧洲",
  "🌍 其他地区"
]);

const uniqueProxyNames = (proxies) => {
  const names = new Map();
  return proxies.map((proxy) => {
    const baseName = reservedProxyNames.has(proxy.name)
      ? `节点 · ${proxy.name}`
      : proxy.name;
    const count = (names.get(baseName) ?? 0) + 1;
    names.set(baseName, count);
    const name = count === 1 ? baseName : `${baseName} · ${count}`;
    return name === proxy.name ? proxy : { ...proxy, name };
  });
};

export function buildSubscriptionPayload(payload) {
  const sourceProxies = payload.proxies.map(validClashProxy).filter(Boolean);
  const uriByProxyFingerprint = new Map();
  const converted = payload.nodes
    .map((node, index) => {
      const proxy = nodeUriToClashProxy(node, index + 1);
      if (proxy && !uriByProxyFingerprint.has(proxyFingerprint(proxy))) {
        uriByProxyFingerprint.set(proxyFingerprint(proxy), node);
      }
      return proxy;
    })
    .filter(Boolean);
  for (const proxy of sourceProxies) {
    const uri = clashProxyToUri(proxy);
    if (uri && !uriByProxyFingerprint.has(proxyFingerprint(proxy))) {
      uriByProxyFingerprint.set(proxyFingerprint(proxy), uri);
    }
  }
  const proxies = uniqueProxyNames(dedupeProxies([...sourceProxies, ...converted]));
  const shareUris = dedupe(
    proxies
      .map((proxy) => uriByProxyFingerprint.get(proxyFingerprint(proxy)))
      .filter(Boolean)
  );
  return { proxies, shareUris, uriByProxyFingerprint };
}

export function renderClashConfig(proxies) {
  const names = proxies.map((proxy) => proxy.name);
  const healthCheck = {
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
    timeout: 5000,
    "expected-status": 204,
    lazy: true,
    "max-failed-times": 2
  };
  const regionDefinitions = [
    { name: "🇭🇰 香港", codes: ["HK"] },
    { name: "🇸🇬 新加坡", codes: ["SG"] },
    { name: "🇯🇵 日本", codes: ["JP"] },
    { name: "🇹🇼 台湾", codes: ["TW"] },
    { name: "🇺🇸 美国", codes: ["US"] },
    { name: "🇪🇺 欧洲", codes: ["DE", "FR", "NL", "GB", "SE"] }
  ];
  const assignedRegions = new Set(regionDefinitions.flatMap((item) => item.codes));
  const regionGroups = regionDefinitions
    .map((definition) => ({
      name: definition.name,
      type: "url-test",
      ...healthCheck,
      tolerance: 100,
      proxies: proxies
        .filter((proxy) => definition.codes.includes(regionOf(proxy.name)))
        .map((proxy) => proxy.name)
    }))
    .filter((group) => group.proxies.length);
  const otherNames = proxies
    .filter((proxy) => !assignedRegions.has(regionOf(proxy.name)))
    .map((proxy) => proxy.name);
  if (otherNames.length) {
    regionGroups.push({
      name: "🌍 其他地区",
      type: "url-test",
      ...healthCheck,
      tolerance: 100,
      proxies: otherNames
    });
  }
  const regionGroupNames = regionGroups.map((group) => group.name);
  const telegramChoices = [
    "🚢 FREEPORT",
    ...["🇸🇬 新加坡", "🇭🇰 香港", "🇺🇸 美国"].filter((name) =>
      regionGroupNames.includes(name)
    ),
    "♻️ AUTO",
    "DIRECT"
  ];
  const ruleProvider = (name, behavior) => ({
    type: "http",
    behavior,
    format: "yaml",
    url: `https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/${name}.txt`,
    path: `./ruleset/${name}.yaml`,
    interval: 86400,
    "size-limit": 10_000_000
  });
  return stringifyYaml(
    {
      "mixed-port": 7890,
      "allow-lan": false,
      mode: "rule",
      "log-level": "info",
      ipv6: true,
      "unified-delay": true,
      "tcp-concurrent": true,
      "etag-support": true,
      profile: {
        "store-selected": true,
        "store-fake-ip": true
      },
      sniffer: {
        enable: true,
        "force-dns-mapping": true,
        "parse-pure-ip": true,
        "override-destination": true,
        sniff: {
          HTTP: {
            ports: ["80", "8080-8880"],
            "override-destination": true
          },
          TLS: { ports: ["443", "8443"] },
          QUIC: { ports: ["443", "8443"] }
        },
        "skip-domain": ["Mijia Cloud", "+.push.apple.com"]
      },
      dns: {
        enable: true,
        ipv6: true,
        listen: "127.0.0.1:1053",
        "enhanced-mode": "fake-ip",
        "fake-ip-range": "198.18.0.1/16",
        "fake-ip-filter-mode": "rule",
        "fake-ip-filter": [
          "RULE-SET,private,real-ip",
          "RULE-SET,direct,real-ip",
          "DOMAIN-SUFFIX,lan,real-ip",
          "DOMAIN-SUFFIX,local,real-ip",
          "MATCH,fake-ip"
        ],
        "use-hosts": true,
        "use-system-hosts": true,
        "respect-rules": true,
        "default-nameserver": ["223.5.5.5", "119.29.29.29"],
        nameserver: [
          "https://dns.alidns.com/dns-query",
          "https://doh.pub/dns-query"
        ],
        "proxy-server-nameserver": [
          "https://dns.alidns.com/dns-query",
          "https://doh.pub/dns-query"
        ],
        "direct-nameserver": [
          "https://dns.alidns.com/dns-query",
          "https://doh.pub/dns-query"
        ],
        "nameserver-policy": {
          "rule-set:private": [
            "https://dns.alidns.com/dns-query",
            "https://doh.pub/dns-query"
          ],
          "rule-set:direct": [
            "https://dns.alidns.com/dns-query",
            "https://doh.pub/dns-query"
          ],
          "rule-set:proxy": [
            "https://1.1.1.1/dns-query",
            "https://dns.google/dns-query"
          ]
        }
      },
      proxies,
      "proxy-groups": [
        {
          name: "🚢 FREEPORT",
          type: "select",
          proxies: [
            "♻️ AUTO",
            "🛟 FALLBACK",
            ...regionGroupNames,
            "DIRECT",
            ...names
          ]
        },
        {
          name: "♻️ AUTO",
          type: "url-test",
          ...healthCheck,
          tolerance: 100,
          proxies: names
        },
        {
          name: "🛟 FALLBACK",
          type: "fallback",
          ...healthCheck,
          proxies: names
        },
        ...regionGroups,
        {
          name: "💬 TELEGRAM",
          type: "select",
          proxies: telegramChoices
        },
        {
          name: "🛡️ ADS",
          type: "select",
          proxies: ["REJECT", "DIRECT"]
        }
      ],
      "rule-providers": {
        applications: ruleProvider("applications", "classical"),
        private: ruleProvider("private", "domain"),
        reject: ruleProvider("reject", "domain"),
        icloud: ruleProvider("icloud", "domain"),
        apple: ruleProvider("apple", "domain"),
        google: ruleProvider("google", "domain"),
        proxy: ruleProvider("proxy", "domain"),
        direct: ruleProvider("direct", "domain"),
        lancidr: ruleProvider("lancidr", "ipcidr"),
        cncidr: ruleProvider("cncidr", "ipcidr"),
        telegramcidr: ruleProvider("telegramcidr", "ipcidr")
      },
      rules: [
        "RULE-SET,applications,DIRECT",
        "RULE-SET,private,DIRECT",
        "RULE-SET,reject,🛡️ ADS",
        "RULE-SET,icloud,DIRECT",
        "RULE-SET,apple,DIRECT",
        "RULE-SET,google,🚢 FREEPORT",
        "RULE-SET,proxy,🚢 FREEPORT",
        "RULE-SET,direct,DIRECT",
        "RULE-SET,lancidr,DIRECT,no-resolve",
        "RULE-SET,cncidr,DIRECT,no-resolve",
        "RULE-SET,telegramcidr,💬 TELEGRAM,no-resolve",
        "MATCH,🚢 FREEPORT"
      ]
    },
    { lineWidth: 0 }
  );
}

export function renderClashProvider(proxies) {
  return stringifyYaml({ proxies }, { lineWidth: 0 });
}

export const protoOf = (node) => node.slice(0, node.indexOf(":"));

export const regionOf = (node) => {
  let tag = String(node).includes("#")
    ? String(node).split("#").at(-1)
    : String(node);
  try {
    tag = decodeURIComponent(tag);
  } catch {
    /* 保留原始标签，避免单个错误转义中断整批签发 */
  }

  const flag = tag.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0];
  if (flag) {
    return [...flag]
      .map((character) =>
        String.fromCharCode(character.codePointAt(0) - 0x1f1e6 + 65)
      )
      .join("");
  }
  const prefix = normalizeRegionCode(
    tag.match(/^\s*([a-z]{2})(?:\||[-_: ])/i)?.[1]
  );
  if (prefix) return prefix;

  const namedRegions = [
    ["HK", /香港|Hong\s*Kong|\bHK\b/i],
    ["JP", /日本|Japan|\bJP\b/i],
    ["SG", /新加坡|Singapore|\bSG\b/i],
    ["US", /美国|United\s*States|\bUS\b/i],
    ["TW", /台湾|Taiwan|\bTW\b/i],
    ["KR", /韩国|Korea|\bKR\b/i],
    ["DE", /德国|Germany|\bDE\b/i],
    ["SE", /瑞典|Sweden|\bSE\b/i],
    ["GB", /英国|United\s*Kingdom|\bGB\b|\bUK\b/i],
    ["FR", /法国|France|\bFR\b/i],
    ["NL", /荷兰|Netherlands|\bNL\b/i],
    ["CA", /加拿大|Canada|\bCA\b/i],
    ["AU", /澳大利亚|Australia|\bAU\b/i]
  ];
  for (const [region, pattern] of namedRegions) {
    if (pattern.test(tag)) return region;
  }
  return "OTHER";
};

export const regionFlag = (region) => {
  const code = normalizeRegionCode(region);
  if (!code) return "🌍";
  return [...code]
    .map((character) => String.fromCodePoint(character.charCodeAt(0) - 65 + 0x1f1e6))
    .join("");
};

const cleanProxyLabel = (name) =>
  String(name)
    .replace(/^(?:[\u{1F1E6}-\u{1F1FF}]{2}|🏳️?|🌍)\s*/u, "")
    .replace(/^(?:[a-z]{2}|OTHER)\s*(?:\||[-_:])\s*/i, "")
    .trim();

export const regionLabel = (name, region) => {
  const code = normalizeRegionCode(region) ?? "OTHER";
  const prefix = `${regionFlag(code)} ${code} | `;
  const cleanName = cleanProxyLabel(name) || "node";
  const maximumNameLength = Math.max(1, 180 - [...prefix].length);
  return `${prefix}${[...cleanName].slice(0, maximumNameLength).join("")}`;
};

export function renameNodeUri(node, name) {
  const value = String(node);
  if (value.toLowerCase().startsWith("vmess://")) {
    const encoded = value.slice("vmess://".length).split("#")[0];
    const decoded = decodeBase64(encoded, { strict: false });
    if (!decoded) return value;
    try {
      const payload = JSON.parse(decoded);
      payload.ps = name;
      return `vmess://${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
    } catch {
      return value;
    }
  }
  const fragmentIndex = value.indexOf("#");
  const base = fragmentIndex >= 0 ? value.slice(0, fragmentIndex) : value;
  return `${base}${encodedFragment(name)}`;
}

const proxyRegion = (proxy, regionsByProxy) =>
  regionsByProxy?.get(proxyFingerprint(proxy))?.region ?? regionOf(proxy.name);

export function resolveProxyRegions({
  proxies,
  results = [],
  sourceRegionsByProxy = new Map(),
  previousRegionsByProxy = new Map()
}) {
  const resultByName = new Map(results.map((result) => [result.name, result]));
  const regionsByProxy = new Map();
  for (const proxy of proxies) {
    const key = proxyFingerprint(proxy);
    const result = resultByName.get(proxy.name);
    const detectedRegion = normalizeRegionCode(result?.region);
    const sourceRegions = [
      ...(sourceRegionsByProxy.get(key) ?? [])
    ].map(normalizeRegionCode).filter(Boolean);
    const uniqueSourceRegions = [...new Set(sourceRegions)];
    const sourceRegion = uniqueSourceRegions.length === 1 ? uniqueSourceRegions[0] : undefined;
    const nameRegion = normalizeRegionCode(regionOf(proxy.name));
    const previousRegion = normalizeRegionCode(previousRegionsByProxy.get(key));
    const region = detectedRegion ?? sourceRegion ?? nameRegion ?? previousRegion ?? "OTHER";
    const regionMethod = detectedRegion
      ? "egress"
      : sourceRegion
        ? "source"
        : nameRegion
          ? "name"
          : previousRegion
            ? "previous"
            : "unknown";
    const regionConfidence = detectedRegion
      ? "high"
      : sourceRegion || previousRegion
        ? "medium"
        : nameRegion
          ? "low"
          : "none";
    const declaredRegions = [sourceRegion, nameRegion].filter(Boolean);
    regionsByProxy.set(key, {
      region,
      regionMethod,
      regionConfidence,
      ...(detectedRegion && declaredRegions.some((item) => item !== detectedRegion)
        ? { regionMismatch: true }
        : {})
    });
  }
  return regionsByProxy;
}

export function applyProxyRegions(proxies, regionsByProxy) {
  return uniqueProxyNames(
    proxies.map((proxy) => ({
      ...proxy,
      name: regionLabel(proxy.name, proxyRegion(proxy, regionsByProxy))
    }))
  );
}

export function selectDiverseProxies(
  proxies,
  maximumItems = defaultCandidateLimit,
  regionsByProxy
) {
  const limit = Math.max(0, Math.floor(maximumItems));
  if (proxies.length <= limit) return [...proxies];
  const buckets = new Map();
  for (const proxy of proxies) {
    const key = `${proxyRegion(proxy, regionsByProxy)}\0${proxy.type}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(proxy);
    buckets.set(key, bucket);
  }
  const selected = [];
  let round = 0;
  while (selected.length < limit) {
    let added = false;
    for (const bucket of buckets.values()) {
      if (round < bucket.length) {
        selected.push(bucket[round]);
        added = true;
        if (selected.length >= limit) break;
      }
    }
    if (!added) break;
    round += 1;
  }
  return selected;
}

export function selectPublishedProxies(
  proxies,
  results,
  {
    maximumItems = defaultPublishedLimit,
    maximumLatencyMs = defaultMaxLatencyMs,
    regionsByProxy
  } = {}
) {
  const resultByName = new Map(results.map((result) => [result.name, result]));
  const healthy = proxies
    .filter((proxy) => {
      const result = resultByName.get(proxy.name);
      return (
        result?.alive &&
        Number.isFinite(result.delayMs) &&
        result.delayMs <= maximumLatencyMs
      );
    })
    .sort((a, b) => {
      const resultA = resultByName.get(a.name);
      const resultB = resultByName.get(b.name);
      const speedA = Number.isFinite(resultA?.speedMbps) ? resultA.speedMbps : -1;
      const speedB = Number.isFinite(resultB?.speedMbps) ? resultB.speedMbps : -1;
      return (
        (speedB >= 0) - (speedA >= 0) ||
        speedB - speedA ||
        resultA.delayMs - resultB.delayMs ||
        proxyFingerprint(a).localeCompare(proxyFingerprint(b))
      );
    });
  return selectDiverseProxies(healthy, maximumItems, regionsByProxy);
}

export const publicSubscriptionUrl = (fileName, env = process.env) => {
  const site = String(env.SUB_PUBLIC_BASE_URL || env.SITE_URL || "https://manifest.dpdns.org")
    .trim()
    .replace(/\/+$/, "");
  const base = String(env.BASE_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
  const path = `${base ? `/${base}` : ""}/free/latest/${fileName}`;
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

export async function expireOlderManifests({
  contentDir = "src/content/subs",
  currentDate = today
} = {}) {
  let files;
  try {
    files = await readdir(contentDir);
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }

  let changed = 0;
  for (const file of files) {
    const date = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1];
    if (!date || date >= currentDate) continue;
    const path = `${contentDir}/${file}`;
    const previous = await readFile(path, "utf8");
    let next = previous;
    if (/^expired:\s*false\s*$/m.test(previous)) {
      next = previous.replace(/^expired:\s*false\s*$/m, "expired: true");
    } else if (!/^expired:/m.test(previous)) {
      next = previous.replace(/\n---\s*$/, "\nexpired: true\n---\n");
    }
    if (next !== previous && (await writeIfChanged(path, next))) changed += 1;
  }
  return changed;
}

const sourceProvenance = (reports) => {
  const sourcesByProxy = new Map();
  const sourceRegionsByProxy = new Map();
  for (const report of reports) {
    if (!report.payload) continue;
    const built = buildSubscriptionPayload(report.payload);
    for (const proxy of built.proxies) {
      const key = proxyFingerprint(proxy);
      const sourceIds = sourcesByProxy.get(key) ?? new Set();
      sourceIds.add(report.id);
      sourcesByProxy.set(key, sourceIds);
      if (report.region) {
        const regions = sourceRegionsByProxy.get(key) ?? new Set();
        regions.add(report.region);
        sourceRegionsByProxy.set(key, regions);
      }
    }
  }
  return { sourcesByProxy, sourceRegionsByProxy };
};

export async function loadPreviousRegions(
  path = "public/free/latest/health.json"
) {
  try {
    const report = JSON.parse(await readFile(path, "utf8"));
    return new Map(
      (Array.isArray(report?.nodes) ? report.nodes : [])
        .map((node) => [node?.id, normalizeRegionCode(node?.region)])
        .filter(([id, region]) => typeof id === "string" && region)
    );
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return new Map();
    throw error;
  }
}

const publicSourceReports = (reports) =>
  reports.map((report) => ({
    id: report.id,
    status: report.status,
    nodeCount: report.nodeCount,
    proxyCount: report.proxyCount,
    ...(Number.isInteger(report.discoveredNodeCount)
      ? {
          discoveredNodeCount: report.discoveredNodeCount,
          discoveredProxyCount: report.discoveredProxyCount
        }
      : {}),
    ...(Number.isInteger(report.maxItems) ? { maxItems: report.maxItems } : {}),
    ...(report.region ? { region: report.region } : {}),
    ...(report.license ? { license: report.license } : {}),
    ...(Number.isInteger(report.detailTotal)
      ? {
          detailTotal: report.detailTotal,
          detailFailures: report.detailFailures
        }
      : {})
  }));

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const buildHealthReport = ({
  summary,
  tested,
  sources,
  sourcesByProxy,
  regionsByProxy = new Map(),
  proxies,
  thresholds,
  publishedProxies = [],
  qualityLimits
}) => {
  const resultByName = new Map(summary.results.map((result) => [result.name, result]));
  const publishedAssignments = publishedProxies.map((proxy) =>
    regionsByProxy.get(proxyFingerprint(proxy))
  );
  return {
    schemaVersion: 3,
    manifest: `FP-${compact}-01`,
    status: tested ? "tested" : "skipped",
    testedAt: summary.testedAt,
    thresholds,
    ...(qualityLimits ? { qualityLimits } : {}),
    summary: {
      candidateCount: summary.candidateCount,
      healthyCount: summary.healthyCount,
      failedCount: summary.failedCount,
      publishedCount: publishedProxies.length,
      aliveRatio: summary.aliveRatio,
      latencyMs: summary.latencyMs,
      failureReasons: summary.failureReasons,
      regionDetection: {
        detectedCount: publishedAssignments.filter(
          (assignment) => assignment?.regionMethod === "egress"
        ).length,
        fallbackCount: publishedAssignments.filter(
          (assignment) =>
            assignment?.region !== "OTHER" && assignment?.regionMethod !== "egress"
        ).length,
        otherCount: publishedAssignments.filter(
          (assignment) => !assignment || assignment.region === "OTHER"
        ).length,
        mismatchCount: publishedAssignments.filter(
          (assignment) => assignment?.regionMismatch
        ).length
      }
    },
    sources: publicSourceReports(sources),
    nodes: proxies.map((proxy) => {
      const key = proxyFingerprint(proxy);
      const result = resultByName.get(proxy.name);
      const region = regionsByProxy.get(key) ?? {
        region: "OTHER",
        regionMethod: "unknown",
        regionConfidence: "none"
      };
      return {
        id: key,
        type: proxy.type,
        sourceIds: [...(sourcesByProxy.get(key) ?? [])].sort(),
        region: region.region,
        regionMethod: region.regionMethod,
        regionConfidence: region.regionConfidence,
        ...(region.regionMismatch ? { regionMismatch: true } : {}),
        alive: tested ? Boolean(result?.alive) : null,
        ...(Number.isFinite(result?.delayMs) ? { delayMs: result.delayMs } : {}),
        ...(Number.isFinite(result?.speedMbps)
          ? {
              speedMbps: result.speedMbps,
              speedSampleBytes: result.speedSampleBytes
            }
          : {}),
        ...(result?.speedSampleStatus
          ? {
              speedSampleStatus: result.speedSampleStatus,
              speedSampleBytes: result.speedSampleBytes
            }
          : {}),
        ...(!result?.alive && result?.reason ? { reason: result.reason } : {})
      };
    })
  };
};

const appendRunSummary = ({ summary, reports, publishedCount, tested }) => {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const degraded = reports.filter((report) => report.status !== "ok");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## 每日舱单签发",
      "",
      `- 健康检查：${tested ? "已执行" : "未执行"}`,
      `- 候选 / 存活 / 发布：${summary.candidateCount} / ${summary.healthyCount} / ${publishedCount}`,
      `- 存活率：${(summary.aliveRatio * 100).toFixed(1)}%`,
      `- 来源状态：${degraded.length ? degraded.map((item) => `${item.id}=${item.status}`).join("，") : "全部正常"}`,
      ""
    ].join("\n")
  );
};

const setChangedOutput = (changed) => {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
};

async function main() {
  const sources = await loadSourceSpecs();
  const fetched = await fetchSourcePayloads(sources);
  const built = buildSubscriptionPayload(fetched);
  const { sourcesByProxy, sourceRegionsByProxy } = sourceProvenance(fetched.reports);
  const previousRegionsByProxy = await loadPreviousRegions();
  const candidateLimit = Math.floor(
    positiveNumber(process.env.HEALTH_MAX_CANDIDATES, defaultCandidateLimit)
  );
  const publishedLimit = Math.floor(
    positiveNumber(process.env.HEALTH_MAX_PUBLISHED, defaultPublishedLimit)
  );
  const maximumLatencyMs = positiveNumber(
    process.env.HEALTH_MAX_LATENCY_MS,
    defaultMaxLatencyMs
  );
  const preliminaryRegions = resolveProxyRegions({
    proxies: built.proxies,
    sourceRegionsByProxy,
    previousRegionsByProxy
  });
  const proxies = selectDiverseProxies(
    built.proxies,
    candidateLimit,
    preliminaryRegions
  );
  const requireHealthCheck = process.env.REQUIRE_HEALTH_CHECK === "true";
  if (!proxies.length || !built.shareUris.length) {
    setChangedOutput(false);
    throw new Error("没有拉到可签发的 Clash 与 V2Ray 节点，今日签发失败");
  }

  const thresholds = {
    minimumHealthy: Math.floor(
      positiveNumber(process.env.HEALTH_MIN_NODES, 5)
    ),
    minimumRatio: positiveNumber(process.env.HEALTH_MIN_RATIO, 0.2)
  };
  const tested = Boolean(process.env.MIHOMO_BIN);
  if (requireHealthCheck && !tested) {
    throw new Error("REQUIRE_HEALTH_CHECK=true，但未配置 MIHOMO_BIN");
  }
  const summary = tested
    ? await probeProxies(proxies, {
        speedSampleSize: Math.floor(
          positiveNumber(process.env.HEALTH_SPEED_SAMPLES, 12)
        ),
        speedSampleMaxAttempts: Math.floor(
          positiveNumber(process.env.HEALTH_SPEED_ATTEMPTS, 20)
        ),
        regionTimeoutSeconds: positiveNumber(
          process.env.HEALTH_REGION_TIMEOUT_SECONDS,
          5
        ),
        regionMaximumLatencyMs: maximumLatencyMs
      })
    : summarizeProbeResults(
        proxies.map((proxy) => ({
          name: proxy.name,
          type: proxy.type,
          alive: true,
          delayMs: null
        }))
      );
  if (tested) assertProbeThreshold(summary, thresholds);

  const regionsByProxy = resolveProxyRegions({
    proxies,
    results: summary.results,
    sourceRegionsByProxy,
    previousRegionsByProxy
  });
  const selectedPublishedProxies = tested
    ? selectPublishedProxies(proxies, summary.results, {
        maximumItems: publishedLimit,
        maximumLatencyMs,
        regionsByProxy
      })
    : selectDiverseProxies(proxies, publishedLimit, regionsByProxy);
  const publishedProxies = applyProxyRegions(
    selectedPublishedProxies,
    regionsByProxy
  );
  const shareUris = dedupe(
    publishedProxies
      .map((proxy) => {
        const uri = built.uriByProxyFingerprint.get(proxyFingerprint(proxy));
        return uri ? renameNodeUri(uri, proxy.name) : undefined;
      })
      .filter(Boolean)
  );
  if (
    publishedProxies.length < thresholds.minimumHealthy ||
    shareUris.length < thresholds.minimumHealthy
  ) {
    throw new Error(
      `质量过滤后仅剩 Clash ${publishedProxies.length} / V2Ray ${shareUris.length} 个节点`
    );
  }

  const artifactDir = `public/free/${compact}`;
  const counts = new Map();
  for (const proxy of publishedProxies) {
    const key = `${regionOf(proxy.name)}|${proxy.type}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const breakdown = [...counts.entries()]
    .map(([key, count]) => {
      const [region, protocol] = key.split("|");
      return { region, protocol, count };
    })
    .sort(
      (a, b) =>
        (a.region === "OTHER") - (b.region === "OTHER") ||
        b.count - a.count ||
        a.region.localeCompare(b.region)
    );

  const regions = [...new Set(breakdown.map((item) => item.region))];
  const protocolList = [...new Set(publishedProxies.map((proxy) => proxy.type))];
  const breakdownBlock = breakdown.length
    ? `breakdown:\n${breakdown
        .map(
          (item) =>
            `  - { region: "${item.region}", protocol: "${item.protocol}", count: ${item.count} }`
        )
        .join("\n")}\n`
    : "";
  const degradedSources = fetched.reports.filter(
    (report) => report.status !== "ok"
  );
  const noteParts = [
    tested
      ? `发布前实测 ${summary.healthyCount}/${summary.candidateCount} 个候选节点可用`
      : "本次未执行发布前连通性检查"
  ];
  if (degradedSources.length) {
    noteParts.push(
      `来源降级：${degradedSources
        .map((report) => `${report.id}(${report.status})`)
        .join("、")}`
    );
  }
  const healthUrl = publicSubscriptionUrl("health.json");
  const frontmatter = `---
date: ${today}
serial: "01"
issuedAt: "${new Date().toISOString()}"
clash: "${publicSubscriptionUrl("clash.yaml")}"
v2ray: "${publicSubscriptionUrl("v2ray.txt")}"
nodeCount: ${publishedProxies.length}
regions: ${JSON.stringify(regions)}
protocols: ${JSON.stringify(protocolList)}
${breakdownBlock}${tested ? `alive: ${summary.aliveRatio}\ntestedAt: "${summary.testedAt}"\n` : ""}health: "${healthUrl}"
note: ${JSON.stringify(noteParts.join("；"))}
expired: false
---
`;

  const report = buildHealthReport({
    summary,
    tested,
    sources: fetched.reports,
    sourcesByProxy,
    regionsByProxy,
    proxies,
    thresholds,
    publishedProxies,
    qualityLimits: {
      candidateLimit,
      publishedLimit,
      maximumLatencyMs
    }
  });
  const clashContent = renderClashConfig(publishedProxies);
  const providerContent = renderClashProvider(publishedProxies);
  const v2rayContent = `${Buffer.from(`${shareUris.join("\n")}\n`, "utf8").toString("base64")}\n`;
  const healthContent = `${JSON.stringify(report, null, 2)}\n`;
  const changes = await Promise.all([
    writeIfChanged(`${artifactDir}/clash.yaml`, clashContent),
    writeIfChanged(`${artifactDir}/provider.yaml`, providerContent),
    writeIfChanged(`${artifactDir}/v2ray.txt`, v2rayContent),
    writeIfChanged(`${artifactDir}/health.json`, healthContent),
    writeIfChanged("public/free/latest/clash.yaml", clashContent),
    writeIfChanged("public/free/latest/provider.yaml", providerContent),
    writeIfChanged("public/free/latest/v2ray.txt", v2rayContent),
    writeIfChanged("public/free/latest/health.json", healthContent),
    writeIfChanged(`src/content/subs/${today}.md`, frontmatter)
  ]);
  const expiredCount = await expireOlderManifests();
  const changed = changes.some(Boolean) || expiredCount > 0;
  setChangedOutput(changed);
  appendRunSummary({
    summary,
    reports: fetched.reports,
    publishedCount: publishedProxies.length,
    tested
  });
  console.log(
    `签发 FP-${compact}-01 —— 候选 ${proxies.length} 件，Clash ${publishedProxies.length} 件，V2Ray ${shareUris.length} 件，过期 ${expiredCount} 份${changed ? "" : "（无变化）"}`
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
