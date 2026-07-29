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
    if (url.endsWith("/rulesets") && options.method === "GET") {
      return jsonResponse([
        {
          id: "free-waf-1",
          name: "Cloudflare Managed Free Ruleset",
          kind: "managed",
          phase: "http_request_firewall_managed"
        }
      ]);
    }
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
  assert.equal(result.managedWaf.action, "create-entrypoint");
  assert.equal(result.managedWaf.applied, true);
  const waf = calls.find(
    (call) => call.url.endsWith("/rulesets") && call.options.method === "POST"
  );
  assert.deepEqual(JSON.parse(waf.options.body).rules, [
    {
      action: "execute",
      action_parameters: { id: "free-waf-1" },
      expression: "true",
      description: "Execute Cloudflare Managed Free Ruleset",
      enabled: true
    }
  ]);
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

test("Cloudflare WAF reconciliation is idempotent when already deployed", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/zones?")) return jsonResponse([{ id: "zone-1" }]);
    if (url.includes("/dns_records")) {
      return jsonResponse([
        {
          id: "dns-1",
          type: "CNAME",
          content: "skxxxkx666.github.io",
          proxied: true,
          ttl: 1
        }
      ]);
    }
    if (url.endsWith("/ssl/universal/settings")) {
      return jsonResponse({ enabled: true });
    }
    if (url.includes("/settings/")) {
      const id = url.split("/").at(-1);
      const setting = baselineZoneSettings.find((item) => item.id === id);
      return jsonResponse({
        value:
          setting?.value ??
          {
            strict_transport_security: {
              enabled: false,
              include_subdomains: false,
              max_age: 0,
              nosniff: true,
              preload: false
            }
          }
      });
    }
    if (url.endsWith("/rulesets")) {
      return jsonResponse([
        {
          id: "free-waf-1",
          name: "Cloudflare Managed Free Ruleset",
          kind: "managed",
          phase: "http_request_firewall_managed"
        },
        {
          id: "entrypoint-1",
          name: "zone",
          kind: "zone",
          phase: "http_request_firewall_managed"
        }
      ]);
    }
    if (url.endsWith("/rulesets/entrypoint-1")) {
      return jsonResponse({
        id: "entrypoint-1",
        rules: [
          {
            id: "rule-1",
            action: "execute",
            action_parameters: { id: "free-waf-1" },
            expression: "true",
            enabled: true
          }
        ]
      });
    }
    return jsonResponse({});
  };

  const result = await reconcileCloudflareZone({
    token: "secret",
    proxied: true,
    fetchImpl
  });

  assert.equal(result.managedWaf.action, "unchanged");
  assert.ok(calls.every((call) => call.options.method === "GET"));
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
