import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  apiRequest,
  reconcileCloudflareDns
} from "./cloudflare-dns.mjs";

export const baselineZoneSettings = [
  { id: "ssl", value: "strict", label: "SSL/TLS 加密模式：完全（严格）" },
  { id: "always_use_https", value: "on", label: "始终使用 HTTPS" },
  { id: "min_tls_version", value: "1.2", label: "最低 TLS 版本：1.2" },
  { id: "tls_1_3", value: "on", label: "TLS 1.3" },
  { id: "automatic_https_rewrites", value: "on", label: "自动 HTTPS 重写" },
  { id: "brotli", value: "on", label: "Brotli 压缩" },
  { id: "http2", value: "on", label: "HTTP/2" },
  { id: "http3", value: "on", label: "HTTP/3 (QUIC)" },
  { id: "0rtt", value: "off", label: "0-RTT：关闭，避免重放风险" },
  { id: "security_level", value: "medium", label: "安全级别：中" },
  {
    id: "browser_check",
    value: "off",
    label: "浏览器完整性检查：关闭，兼容订阅客户端"
  },
  {
    id: "hotlink_protection",
    value: "off",
    label: "热链保护：关闭，允许订阅直链"
  },
  {
    id: "rocket_loader",
    value: "off",
    label: "Rocket Loader：关闭，避免改写 Astro 脚本"
  }
];

const hstsValue = (enabled) => ({
  strict_transport_security: {
    enabled,
    include_subdomains: false,
    max_age: enabled ? 15_552_000 : 0,
    nosniff: true,
    preload: false
  }
});

const matchesDesired = (current, desired) => {
  if (desired && typeof desired === "object" && !Array.isArray(desired)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return false;
    return Object.entries(desired).every(([key, value]) =>
      matchesDesired(current[key], value)
    );
  }
  return current === desired;
};

const reconcileUniversalSsl = async ({
  token,
  zoneId,
  apply,
  fetchImpl
}) => {
  const path = `/zones/${zoneId}/ssl/universal/settings`;
  const current = await apiRequest(path, { token, fetchImpl });
  if (current?.enabled === true) {
    return { id: "universal_ssl", action: "unchanged", applied: false, desired: true };
  }
  if (!apply) {
    return { id: "universal_ssl", action: "update", applied: false, desired: true };
  }
  await apiRequest(path, {
    token,
    fetchImpl,
    method: "PATCH",
    body: { enabled: true }
  });
  return { id: "universal_ssl", action: "update", applied: true, desired: true };
};

const reconcileZoneSetting = async ({
  token,
  zoneId,
  setting,
  apply,
  fetchImpl
}) => {
  const path = `/zones/${zoneId}/settings/${setting.id}`;
  const current = await apiRequest(path, { token, fetchImpl });
  if (matchesDesired(current?.value, setting.value)) {
    return {
      id: setting.id,
      label: setting.label,
      action: "unchanged",
      applied: false,
      desired: setting.value
    };
  }
  if (current?.editable === false) {
    return {
      id: setting.id,
      label: setting.label,
      action: "unsupported",
      applied: false,
      desired: setting.value
    };
  }
  if (!apply) {
    return {
      id: setting.id,
      label: setting.label,
      action: "update",
      applied: false,
      desired: setting.value
    };
  }
  await apiRequest(path, {
    token,
    fetchImpl,
    method: "PATCH",
    body: { value: setting.value }
  });
  return {
    id: setting.id,
    label: setting.label,
    action: "update",
    applied: true,
    desired: setting.value
  };
};

export async function reconcileCloudflareZone({
  token,
  zoneId,
  zoneName = "manifest.dpdns.org",
  recordName = "manifest.dpdns.org",
  target = "skxxxkx666.github.io",
  proxied = false,
  enableHsts = false,
  apply = false,
  fetchImpl = fetch
} = {}) {
  if (enableHsts && !proxied) {
    throw new Error("启用 HSTS 前必须先使用 --proxied");
  }

  const dns = await reconcileCloudflareDns({
    token,
    zoneId,
    zoneName,
    recordName,
    target,
    proxied,
    apply,
    fetchImpl
  });
  const resolvedZoneId = dns.zoneId;
  const universalSsl = await reconcileUniversalSsl({
    token,
    zoneId: resolvedZoneId,
    apply,
    fetchImpl
  });
  const settings = [
    ...baselineZoneSettings,
    {
      id: "security_header",
      value: hstsValue(enableHsts),
      label: enableHsts
        ? "HSTS：6 个月，不含子域、不预加载"
        : "HSTS：暂不启用；保留 nosniff"
    }
  ];
  const zoneSettings = [];
  for (const setting of settings) {
    zoneSettings.push(
      await reconcileZoneSetting({
        token,
        zoneId: resolvedZoneId,
        setting,
        apply,
        fetchImpl
      })
    );
  }

  return {
    zoneId: resolvedZoneId,
    stage: enableHsts ? "hsts" : proxied ? "proxied" : "dns-only",
    dns,
    universalSsl,
    settings: zoneSettings
  };
}

const printResult = (result) => {
  console.log(`Cloudflare 阶段: ${result.stage}`);
  console.log(
    `- DNS: ${result.dns.action} (${result.dns.desired.proxied ? "Proxied" : "DNS only"})`
  );
  console.log(`- Universal SSL: ${result.universalSsl.action}`);
  for (const setting of result.settings) {
    console.log(`- ${setting.label}: ${setting.action}`);
  }
};

async function main() {
  const result = await reconcileCloudflareZone({
    token: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    zoneName: process.env.CLOUDFLARE_ZONE_NAME,
    recordName: process.env.CLOUDFLARE_RECORD_NAME,
    target: process.env.CLOUDFLARE_RECORD_TARGET,
    proxied:
      process.argv.includes("--proxied") || process.env.CLOUDFLARE_PROXIED === "true",
    enableHsts:
      process.argv.includes("--hsts") || process.env.CLOUDFLARE_ENABLE_HSTS === "true",
    apply: process.argv.includes("--apply")
  });
  printResult(result);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
