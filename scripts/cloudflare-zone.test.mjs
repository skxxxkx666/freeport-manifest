import test from "node:test";
import assert from "node:assert/strict";
import {
  baselineZoneSettings,
  reconcileCloudflareZone
} from "./cloudflare-zone.mjs";

const jsonResponse = (result, status = 200) =>
  new Response(JSON.stringify({ success: status < 400, result }), {
    status,
    headers: { "content-type": "application/json" }
  });

const driftedCloudflare = (calls, { editable = true } = {}) =>
  async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/zones?")) return jsonResponse([{ id: "zone-1" }]);
    if (url.includes("/dns_records") && options.method === "GET") {
      return jsonResponse([]);
    }
    if (url.endsWith("/ssl/universal/settings") && options.method === "GET") {
      return jsonResponse({ enabled: false });
    }
    if (url.includes("/settings/") && options.method === "GET") {
      return jsonResponse({ value: "drifted", editable });
    }
    return jsonResponse({});
  };

test("Cloudflare zone plan is read-only and covers the secure baseline", async () => {
  const calls = [];
  const result = await reconcileCloudflareZone({
    token: "secret",
    fetchImpl: driftedCloudflare(calls)
  });

  assert.equal(result.stage, "dns-only");
  assert.equal(result.dns.action, "create");
  assert.equal(result.universalSsl.action, "update");
  assert.equal(result.settings.length, baselineZoneSettings.length + 1);
  assert.ok(result.settings.every((setting) => setting.action === "update"));
  assert.ok(calls.every((call) => call.options.method === "GET"));
});

test("Cloudflare zone apply writes DNS, Universal SSL, and editable settings", async () => {
  const calls = [];
  const result = await reconcileCloudflareZone({
    token: "secret",
    proxied: true,
    apply: true,
    fetchImpl: driftedCloudflare(calls)
  });

  assert.equal(result.stage, "proxied");
  assert.equal(result.dns.desired.proxied, true);
  assert.equal(result.dns.applied, true);
  assert.equal(result.universalSsl.applied, true);
  assert.ok(result.settings.every((setting) => setting.applied));
  assert.equal(
    calls.filter((call) => call.options.method === "PATCH").length,
    baselineZoneSettings.length + 2
  );
});

test("Cloudflare zone apply reports plan-locked settings without mutating them", async () => {
  const calls = [];
  const result = await reconcileCloudflareZone({
    token: "secret",
    apply: true,
    fetchImpl: driftedCloudflare(calls, { editable: false })
  });

  assert.ok(result.settings.every((setting) => setting.action === "unsupported"));
  assert.equal(
    calls.filter(
      (call) => call.url.includes("/settings/") && call.options.method === "PATCH"
    ).length,
    0
  );
});

test("HSTS cannot be enabled before the proxied stage", async () => {
  await assert.rejects(
    reconcileCloudflareZone({ token: "secret", enableHsts: true }),
    /必须先使用 --proxied/
  );
});

test("cache purge is restricted to the proxied stage and the managed hostname", async () => {
  await assert.rejects(
    reconcileCloudflareZone({ token: "secret", purgeCache: true }),
    /必须先使用 --proxied/
  );

  const calls = [];
  const result = await reconcileCloudflareZone({
    token: "secret",
    proxied: true,
    purgeCache: true,
    apply: true,
    fetchImpl: driftedCloudflare(calls)
  });
  const purge = calls.find((call) => call.url.endsWith("/purge_cache"));
  assert.equal(result.cachePurge.applied, true);
  assert.equal(purge.options.method, "POST");
  assert.deepEqual(JSON.parse(purge.options.body), {
    hosts: ["manifest.dpdns.org"]
  });
});
