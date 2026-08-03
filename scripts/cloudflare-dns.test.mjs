import test from "node:test";
import assert from "node:assert/strict";
import {
  reconcileCloudflareDns,
  reconcileCloudflareTxt
} from "./cloudflare-dns.mjs";

const jsonResponse = (result, status = 200) =>
  new Response(JSON.stringify({ success: status < 400, result }), {
    status,
    headers: { "content-type": "application/json" }
  });

test("Cloudflare plan reports a missing CNAME without mutating DNS", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return url.includes("/zones?") ? jsonResponse([{ id: "zone-1" }]) : jsonResponse([]);
  };

  const result = await reconcileCloudflareDns({ token: "secret", fetchImpl });
  assert.equal(result.action, "create");
  assert.equal(result.applied, false);
  assert.deepEqual(calls.map((call) => call.options.method), ["GET", "GET"]);
});

test("Cloudflare apply creates a DNS-only apex CNAME", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/zones?")) return jsonResponse([{ id: "zone-1" }]);
    if (options.method === "GET") return jsonResponse([]);
    return jsonResponse({ id: "record-1" });
  };

  const result = await reconcileCloudflareDns({
    token: "secret",
    apply: true,
    fetchImpl
  });
  const mutation = calls.at(-1);
  assert.equal(result.action, "create");
  assert.equal(result.applied, true);
  assert.equal(mutation.options.method, "POST");
  assert.deepEqual(JSON.parse(mutation.options.body), {
    type: "CNAME",
    name: "manifest.dpdns.org",
    content: "skxxxkx666.github.io",
    ttl: 1,
    proxied: false,
    comment: "Managed by freeport-manifest"
  });
});

test("Cloudflare apply updates a drifted CNAME", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/zones?")) return jsonResponse([{ id: "zone-1" }]);
    if (options.method === "GET") {
      return jsonResponse([
        {
          id: "record-1",
          type: "CNAME",
          name: "manifest.dpdns.org",
          content: "old.example.com",
          ttl: 300,
          proxied: true
        }
      ]);
    }
    return jsonResponse({ id: "record-1" });
  };

  const result = await reconcileCloudflareDns({
    token: "secret",
    apply: true,
    fetchImpl
  });
  assert.equal(result.action, "update");
  assert.equal(calls.at(-1).options.method, "PUT");
  assert.match(calls.at(-1).url, /dns_records\/record-1$/);
});

test("Cloudflare reconciliation refuses to replace conflicting record types", async () => {
  const fetchImpl = async (url) =>
    url.includes("/zones?")
      ? jsonResponse([{ id: "zone-1" }])
      : jsonResponse([
          {
            id: "record-1",
            type: "A",
            name: "manifest.dpdns.org",
            content: "192.0.2.1"
          }
        ]);

  await assert.rejects(
    reconcileCloudflareDns({ token: "secret", apply: true, fetchImpl }),
    /冲突记录: A/
  );
});

test("Cloudflare CNAME reconciliation allows an apex verification TXT", async () => {
  const fetchImpl = async (url) =>
    url.includes("/zones?")
      ? jsonResponse([{ id: "zone-1" }])
      : jsonResponse([
          {
            id: "record-cname",
            type: "CNAME",
            name: "manifest.dpdns.org",
            content: "skxxxkx666.github.io",
            ttl: 1,
            proxied: false
          },
          {
            id: "record-txt",
            type: "TXT",
            name: "manifest.dpdns.org",
            content: "google-site-verification=token"
          }
        ]);

  const result = await reconcileCloudflareDns({
    token: "secret",
    fetchImpl
  });

  assert.equal(result.action, "unchanged");
  assert.equal(result.applied, false);
});

test("Cloudflare TXT apply preserves existing TXT records and creates the requested value", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/zones?")) return jsonResponse([{ id: "zone-1" }]);
    if (options.method === "GET") {
      return jsonResponse([
        {
          id: "record-old",
          type: "TXT",
          name: "manifest.dpdns.org",
          content: "existing=value"
        }
      ]);
    }
    return jsonResponse({ id: "record-new" });
  };

  const result = await reconcileCloudflareTxt({
    token: "secret",
    content: "google-site-verification=token",
    apply: true,
    fetchImpl
  });

  assert.equal(result.action, "create");
  assert.equal(result.applied, true);
  assert.equal(calls.at(-1).options.method, "POST");
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    type: "TXT",
    name: "manifest.dpdns.org",
    content: "google-site-verification=token",
    ttl: 1,
    comment: "Managed by freeport-manifest"
  });
});

test("Cloudflare TXT reconciliation is idempotent", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return url.includes("/zones?")
      ? jsonResponse([{ id: "zone-1" }])
      : jsonResponse([
          {
            id: "record-1",
            type: "TXT",
            name: "manifest.dpdns.org",
            content: "google-site-verification=token"
          }
        ]);
  };

  const result = await reconcileCloudflareTxt({
    token: "secret",
    content: "google-site-verification=token",
    apply: true,
    fetchImpl
  });

  assert.equal(result.action, "unchanged");
  assert.equal(result.applied, false);
  assert.deepEqual(calls.map((call) => call.options.method), ["GET", "GET"]);
});
