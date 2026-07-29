import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const indexNowKey = "3a7132ef3b78aaf86c2228c9d067115a";
export const indexablePaths = ["", "today/", "archive/", "faq/", "upgrade/"];

export const buildIndexNowPayload = (
  siteUrl = process.env.SITE_URL || "https://manifest.dpdns.org"
) => {
  const site = new URL(String(siteUrl).replace(/\/+$/, "") + "/");
  return {
    host: site.host,
    key: indexNowKey,
    keyLocation: new URL(`${indexNowKey}.txt`, site).href,
    urlList: indexablePaths.map((path) => new URL(path, site).href)
  };
};

export async function submitIndexNow({
  siteUrl,
  endpoint = "https://api.indexnow.org/indexnow",
  fetchImpl = fetch
} = {}) {
  const payload = buildIndexNowPayload(siteUrl);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "freeport-manifest/1.0"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  });
  if (![200, 202].includes(response.status)) {
    throw new Error(`IndexNow 提交失败：HTTP ${response.status}`);
  }
  return { status: response.status, submitted: payload.urlList.length };
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const result = await submitIndexNow();
  console.log(
    `IndexNow 已接收 ${result.submitted} 个 URL（HTTP ${result.status}）`
  );
}
