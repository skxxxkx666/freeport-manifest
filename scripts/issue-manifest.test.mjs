import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHealthReport,
  buildSubscriptionPayload,
  clashProxyToUri,
  dedupe,
  expireOlderManifests,
  fetchSourcePayloads,
  fetchSources,
  nodeUriToClashProxy,
  parseNodes,
  parseSourceBody,
  parseSourcePayload,
  parseSourceSpecs,
  parseV2NodesDetail,
  parseV2NodesIndex,
  protoOf,
  proxyFingerprint,
  regionOf,
  renderClashConfig
} from "./issue-manifest.mjs";
import { parse as parseYaml } from "yaml";

test("parseNodes filters unsupported lines and dedupe removes repeats", () => {
  const parsed = parseNodes([
    "vmess://alpha#HK",
    "not-a-node",
    "vmess://alpha#HK",
    "vless://beta#Japan",
    "ss://gamma#US"
  ].join("\n"));

  assert.deepEqual(dedupe(parsed), [
    "vmess://alpha#HK",
    "vless://beta#Japan",
    "ss://gamma#US"
  ]);
});

test("protocol and region metadata are derived from node URLs", () => {
  assert.equal(protoOf("trojan://node#SG"), "trojan");
  assert.equal(regionOf("vmess://node#Hong%20Kong"), "HK");
  assert.equal(regionOf("vless://node#Japan"), "JP");
  assert.equal(regionOf("ss://node#Singapore"), "SG");
  assert.equal(regionOf("trojan://node#United%20States"), "US");
});

test("parseSourceSpecs supports legacy URLs and JSON sources with headers", () => {
  assert.deepEqual(
    parseSourceSpecs("https://one.example/sub https://two.example/sub"),
    [
      { url: "https://one.example/sub", headers: {} },
      { url: "https://two.example/sub", headers: {} }
    ]
  );

  assert.deepEqual(
    parseSourceSpecs(JSON.stringify({
      sources: [
        {
          url: "https://api.example/sub",
          headers: { Authorization: "Bearer secret", "X-Source": 2 }
        }
      ]
    })),
    [
      {
        url: "https://api.example/sub",
        headers: { Authorization: "Bearer secret", "X-Source": "2" }
      }
    ]
  );
});

test("parseSourceBody decodes base64 and nested JSON API payloads", () => {
  const encoded = Buffer.from("vmess://alpha#HK\nvless://beta#Japan").toString("base64");
  assert.deepEqual(parseSourceBody(encoded), [
    "vmess://alpha#HK",
    "vless://beta#Japan"
  ]);
  assert.deepEqual(parseSourceBody(JSON.stringify({ data: encoded })), [
    "vmess://alpha#HK",
    "vless://beta#Japan"
  ]);
});

test("parseSourceBody reads Clash YAML and JSON proxy objects", () => {
  const yaml = `
proxies:
  - { name: "香港 01", type: vmess, server: hk.example.com, port: 443 }
  - { name: "日本 01", type: trojan, server: jp.example.com, port: 443 }
`;
  const fromYaml = parseSourceBody(yaml);
  const fromJson = parseSourceBody(JSON.stringify({
    proxies: [{ name: "新加坡 01", type: "ss", server: "sg.example.com", port: 443 }]
  }));

  assert.deepEqual(fromYaml.map(protoOf), ["vmess", "trojan"]);
  assert.deepEqual(fromYaml.map(regionOf), ["HK", "JP"]);
  assert.deepEqual(fromJson.map(protoOf), ["ss"]);
  assert.deepEqual(fromJson.map(regionOf), ["SG"]);
});

test("fetchSources applies secret JSON headers and merges decoded responses", async () => {
  const calls = [];
  const encoded = Buffer.from("vmess://alpha#HK\nvless://beta#Japan").toString("base64");
  const input = JSON.stringify([
    {
      url: "https://api.example/sub",
      headers: { Authorization: "Bearer secret" }
    },
    "https://plain.example/sub"
  ]);
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const body = url.includes("api.example")
      ? JSON.stringify({ data: encoded })
      : "vmess://alpha#HK\nss://gamma#US";
    return new Response(body, { status: 200 });
  };

  assert.deepEqual(await fetchSources(input, { fetchImpl }), [
    "vmess://alpha#HK",
    "vless://beta#Japan",
    "ss://gamma#US"
  ]);
  assert.equal(calls[0].options.headers.get("authorization"), "Bearer secret");
  assert.equal(calls[0].options.redirect, "manual");
});

test("sources require HTTPS and authenticated redirects stay on the same origin", async () => {
  assert.deepEqual(parseSourceSpecs("http://plain.example/sub"), []);

  const calls = [];
  const payload = await fetchSourcePayloads(
    [
      {
        id: "private",
        url: "https://private.example/sub",
        headers: { Authorization: "Bearer secret" }
      }
    ],
    {
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response("", {
          status: 302,
          headers: { location: "https://other.example/sub" }
        });
      }
    }
  );

  assert.equal(calls.length, 2);
  assert.equal(payload.reports[0].status, "failed");
  assert.deepEqual(payload.nodes, []);
});

test("source response size is capped before reading the body", async () => {
  const payload = await fetchSourcePayloads(
    [{ id: "large", url: "https://large.example/sub", headers: {} }],
    {
      fetchImpl: async () =>
        new Response("small", {
          status: 200,
          headers: { "content-length": "5000001" }
        })
    }
  );

  assert.equal(payload.reports[0].status, "failed");
  assert.match(payload.reports[0].reason, /响应超过/);
});

test("source payload preserves Clash objects for real artifact generation", () => {
  const payload = parseSourcePayload(`
proxies:
  - { name: "SG-Trojan", type: trojan, server: sg.example.com, port: 443, password: pass }
  - { name: "HK-TUIC", type: tuic, server: hk.example.com, port: 443, uuid: id, password: pass }
`);

  assert.equal(payload.proxies.length, 2);
  assert.deepEqual(payload.proxies.map((proxy) => proxy.type), ["trojan", "tuic"]);
});

test("Clash proxies convert to share links and back", () => {
  const vmess = {
    name: "JP VMess",
    type: "vmess",
    server: "jp.example.com",
    port: 443,
    uuid: "11111111-1111-1111-1111-111111111111",
    alterId: 0,
    cipher: "auto",
    tls: true
  };
  const ss = {
    name: "US SS",
    type: "ss",
    server: "us.example.com",
    port: 8388,
    cipher: "aes-256-gcm",
    password: "secret"
  };

  const vmessRoundTrip = nodeUriToClashProxy(clashProxyToUri(vmess));
  const ssRoundTrip = nodeUriToClashProxy(clashProxyToUri(ss));
  assert.equal(vmessRoundTrip.server, vmess.server);
  assert.equal(vmessRoundTrip.uuid, vmess.uuid);
  assert.equal(ssRoundTrip.server, ss.server);
  assert.equal(ssRoundTrip.password, ss.password);
  assert.equal(
    clashProxyToUri({
      ...vmess,
      network: "ws",
      "ws-opts": {
        path: "/",
        headers: {
          Host: "jp.example.com",
          "User-Agent": "required"
        }
      }
    }),
    undefined
  );
});

test("Trojan conversion preserves TLS options and rejects lossy WS headers", () => {
  const trojan = {
    name: "SG Trojan",
    type: "trojan",
    server: "sg.example.com",
    port: 443,
    password: "secret",
    tls: true,
    servername: "edge.example.com",
    network: "ws",
    "ws-opts": {
      path: "/free",
      headers: { Host: "edge.example.com" }
    },
    alpn: ["h2", "http/1.1"],
    "skip-cert-verify": true
  };
  const roundTrip = nodeUriToClashProxy(clashProxyToUri(trojan));

  assert.equal(roundTrip["skip-cert-verify"], true);
  assert.deepEqual(roundTrip.alpn, trojan.alpn);
  assert.equal(roundTrip["ws-opts"].headers.Host, "edge.example.com");
  assert.equal(
    clashProxyToUri({
      ...trojan,
      "ws-opts": {
        ...trojan["ws-opts"],
        headers: {
          ...trojan["ws-opts"].headers,
          "User-Agent": "required"
        }
      }
    }),
    undefined
  );
});

test("V2Nodes adapter extracts detail URLs and HTML-encoded node links", () => {
  const index = `
    <a href="/servers/123/">V2Ray Vless</a>
    <a href="https://zh.v2nodes.com/servers/456/">Trojan</a>
    <a href="/servers/123/">repeat</a>
  `;
  const detail =
    '<div>vless://uuid@sg.example.com:443?security=tls&amp;type=ws&amp;path=/free path#Singapore</div>';

  assert.deepEqual(parseV2NodesIndex(index, "https://zh.v2nodes.com/country/sg/"), [
    "https://zh.v2nodes.com/servers/123/",
    "https://zh.v2nodes.com/servers/456/"
  ]);
  assert.deepEqual(parseV2NodesDetail(detail), [
    "vless://uuid@sg.example.com:443?security=tls&type=ws&path=/free%20path#Singapore"
  ]);
});

test("subscription payload emits valid Clash YAML and base share links", () => {
  const payload = buildSubscriptionPayload({
    nodes: ["vless://uuid@sg.example.com:443?security=tls&type=ws#Singapore"],
    proxies: [
      {
        name: "HK-TUIC",
        type: "tuic",
        server: "hk.example.com",
        port: 443,
        uuid: "id",
        password: "pass"
      }
    ]
  });
  const config = parseYaml(renderClashConfig(payload.proxies));

  assert.equal(payload.proxies.length, 2);
  assert.equal(payload.shareUris.length, 1);
  assert.equal(config.proxies.length, 2);
  assert.deepEqual(config.rules, ["MATCH,🚢 FREEPORT"]);
});

test("same connection with different labels is published once", () => {
  const first = {
    name: "label one",
    type: "trojan",
    server: "same.example.com",
    port: 443,
    password: "secret"
  };
  const payload = buildSubscriptionPayload({
    nodes: [],
    proxies: [first, { ...first, name: "label two" }]
  });

  assert.equal(payload.proxies.length, 1);
  assert.equal(payload.shareUris.length, 1);
});

test("region metadata handles flags, prefixes and unknown labels", () => {
  assert.equal(regionOf("🇸🇬 Singapore"), "SG");
  assert.equal(regionOf("de|Frankfurt"), "DE");
  assert.equal(regionOf("unclassified"), "OTHER");
});

test("older manifests expire without changing the current manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "freeport-manifests-"));
  try {
    const oldPath = join(directory, "2026-07-29.md");
    const currentPath = join(directory, "2026-07-30.md");
    await Promise.all([
      writeFile(oldPath, "---\nexpired: false\n---\n", "utf8"),
      writeFile(currentPath, "---\nexpired: false\n---\n", "utf8")
    ]);

    assert.equal(
      await expireOlderManifests({
        contentDir: directory,
        currentDate: "2026-07-30"
      }),
      1
    );
    assert.match(await readFile(oldPath, "utf8"), /expired: true/);
    assert.match(await readFile(currentPath, "utf8"), /expired: false/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("public health reports omit proxy names and source failure details", () => {
  const proxy = {
    name: "private node label",
    type: "trojan",
    server: "example.com",
    port: 443,
    password: "secret"
  };
  const key = proxyFingerprint(proxy);
  const report = buildHealthReport({
    summary: {
      testedAt: "2026-07-30T00:00:00.000Z",
      candidateCount: 1,
      healthyCount: 0,
      failedCount: 1,
      aliveRatio: 0,
      latencyMs: null,
      failureReasons: { timeout: 1 },
      results: [
        {
          name: proxy.name,
          type: proxy.type,
          alive: false,
          reason: "timeout"
        }
      ]
    },
    tested: true,
    sources: [
      {
        id: "source-a",
        status: "failed",
        nodeCount: 0,
        proxyCount: 0,
        reason: "Bearer source-secret"
      }
    ],
    sourcesByProxy: new Map([[key, new Set(["source-a"])]]),
    proxies: [proxy],
    thresholds: { minimumHealthy: 5, minimumRatio: 0.2 }
  });
  const serialized = JSON.stringify(report);

  assert.equal(report.nodes[0].id, key);
  assert.equal(report.nodes[0].reason, "timeout");
  assert.doesNotMatch(serialized, /private node label|source-secret|example\.com/);
});
