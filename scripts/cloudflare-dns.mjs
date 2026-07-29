import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const apiBase = "https://api.cloudflare.com/client/v4";

export const apiRequest = async (
  path,
  { token, fetchImpl = fetch, method = "GET", body } = {}
) => {
  const response = await fetchImpl(`${apiBase}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const messages = payload.errors?.map((error) => error.message).filter(Boolean);
    throw new Error(messages?.join("; ") || `Cloudflare API HTTP ${response.status}`);
  }
  return payload.result;
};

export const zoneIdFor = async ({ token, zoneId, zoneName, fetchImpl }) => {
  if (zoneId) return zoneId;
  const zones = await apiRequest(
    `/zones?name=${encodeURIComponent(zoneName)}&status=active&per_page=50`,
    { token, fetchImpl }
  );
  if (zones.length !== 1) {
    throw new Error(`Cloudflare 中必须恰好存在一个 active zone: ${zoneName}`);
  }
  return zones[0].id;
};

export async function reconcileCloudflareDns({
  token,
  zoneId,
  zoneName = "manifest.dpdns.org",
  recordName = "manifest.dpdns.org",
  target = "skxxxkx666.github.io",
  proxied = false,
  apply = false,
  fetchImpl = fetch
} = {}) {
  if (!token) throw new Error("缺少 CLOUDFLARE_API_TOKEN");

  const resolvedZoneId = await zoneIdFor({ token, zoneId, zoneName, fetchImpl });
  const records = await apiRequest(
    `/zones/${resolvedZoneId}/dns_records?name=${encodeURIComponent(recordName)}&per_page=100`,
    { token, fetchImpl }
  );
  const conflicts = records.filter((record) => record.type !== "CNAME");
  if (conflicts.length) {
    throw new Error(
      `${recordName} 存在冲突记录: ${conflicts.map((record) => record.type).join(", ")}`
    );
  }
  if (records.length > 1) {
    throw new Error(`${recordName} 存在多个 CNAME，拒绝自动修改`);
  }

  const desired = {
    type: "CNAME",
    name: recordName,
    content: target,
    ttl: 1,
    proxied,
    comment: "Managed by freeport-manifest"
  };
  const current = records[0];
  const matches =
    current?.content?.replace(/\.$/, "").toLowerCase() === target.toLowerCase() &&
    current?.proxied === proxied &&
    current?.ttl === 1;

  if (matches) {
    return { action: "unchanged", applied: false, zoneId: resolvedZoneId, desired };
  }
  const action = current ? "update" : "create";
  if (!apply) {
    return { action, applied: false, zoneId: resolvedZoneId, desired };
  }

  const path = current
    ? `/zones/${resolvedZoneId}/dns_records/${current.id}`
    : `/zones/${resolvedZoneId}/dns_records`;
  await apiRequest(path, {
    token,
    fetchImpl,
    method: current ? "PUT" : "POST",
    body: desired
  });
  return { action, applied: true, zoneId: resolvedZoneId, desired };
}

async function main() {
  const result = await reconcileCloudflareDns({
    token: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    zoneName: process.env.CLOUDFLARE_ZONE_NAME,
    recordName: process.env.CLOUDFLARE_RECORD_NAME,
    target: process.env.CLOUDFLARE_RECORD_TARGET,
    proxied:
      process.argv.includes("--proxied") || process.env.CLOUDFLARE_PROXIED === "true",
    apply: process.argv.includes("--apply")
  });
  console.log(
    `${result.applied ? "已执行" : "计划"}: ${result.action} ${result.desired.name} CNAME ${result.desired.content} (${result.desired.proxied ? "Proxied" : "DNS only"})`
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
