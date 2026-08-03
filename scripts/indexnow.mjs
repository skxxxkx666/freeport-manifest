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
  fetchImpl = fetch,
  retries = 2,
  retryDelayMs = 750,
  waitImpl = (milliseconds) =>
    new Promise((resolveWait) => setTimeout(resolveWait, milliseconds))
} = {}) {
  const payload = buildIndexNowPayload(siteUrl);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "user-agent": "freeport-manifest/1.0"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000)
      });
    } catch (error) {
      if (attempt === retries) {
        throw new Error("IndexNow 提交失败：网络错误", { cause: error });
      }
      await waitImpl(retryDelayMs * 2 ** attempt);
      continue;
    }

    if ([200, 202].includes(response.status)) {
      return {
        status: response.status,
        submitted: payload.urlList.length,
        attempts: attempt + 1
      };
    }
    const transient = response.status >= 500 && response.status <= 599;
    if (!transient || attempt === retries) {
      throw new Error(`IndexNow 提交失败：HTTP ${response.status}`);
    }
    await waitImpl(retryDelayMs * 2 ** attempt);
  }

  throw new Error("IndexNow 提交失败：超过重试次数");
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const result = await submitIndexNow();
  console.log(
    `IndexNow 已接收 ${result.submitted} 个 URL（HTTP ${result.status}，${result.attempts} 次请求）`
  );
}
