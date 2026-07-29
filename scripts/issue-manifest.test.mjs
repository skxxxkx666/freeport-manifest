import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubscriptionPayload,
  clashProxyToUri,
  dedupe,
  fetchSources,
  nodeUriToClashProxy,
  parseNodes,
  parseSourceBody,
  parseSourcePayload,
  parseSourceSpecs,
  parseV2NodesDetail,
  parseV2NodesIndex,
  protoOf,
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
  assert.equal(calls[0].options.redirect, "follow");
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
