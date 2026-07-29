import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildIndexNowPayload } from "./indexnow.mjs";

const distDirectory = "dist";
const expectedOrigin = String(
  process.env.SEO_EXPECTED_ORIGIN ||
    process.env.SITE_URL ||
    "https://manifest.dpdns.org"
).replace(/\/+$/, "");

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : path;
      })
    )
  ).flat();
};

const count = (text, pattern) => [...text.matchAll(pattern)].length;
const contentOf = (html, attribute, value) =>
  html.match(
    new RegExp(
      `<meta\\s+${attribute}="${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content="([^"]*)"\\s*\\/?>`,
      "i"
    )
  )?.[1];
const linkOf = (html, rel) =>
  html.match(
    new RegExp(`<link\\s+rel="${rel}"[^>]*href="([^"]+)"[^>]*>`, "i")
  )?.[1];

const htmlFiles = (await walk(distDirectory)).filter((path) =>
  path.endsWith(".html")
);
const titles = new Map();
const descriptions = new Map();
const expectedCanonicalUrls = [];

for (const path of htmlFiles) {
  const html = await readFile(path, "utf8");
  const page = relative(distDirectory, path).replaceAll("\\", "/");
  const archiveStub = /^archive\/\d{4}-\d{2}-\d{2}\/index\.html$/.test(page);
  const shouldIndex = page !== "404.html" && !archiveStub;
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = contentOf(html, "name", "description");
  const robots = contentOf(html, "name", "robots");
  const canonical = linkOf(html, "canonical");
  const openGraphUrl = contentOf(html, "property", "og:url");
  const openGraphImage = contentOf(html, "property", "og:image");
  const twitterCard = contentOf(html, "name", "twitter:card");
  const jsonLd = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i
  )?.[1];

  assert.equal(count(html, /<title>/gi), 1, `${page}: title 必须唯一`);
  assert.equal(
    count(html, /<meta name="description"/gi),
    1,
    `${page}: description 必须唯一`
  );
  assert.equal(
    count(html, /<link rel="canonical"/gi),
    1,
    `${page}: canonical 必须唯一`
  );
  assert.ok(title && title.length >= 8, `${page}: title 缺失或过短`);
  assert.ok(
    description && description.length >= 30,
    `${page}: description 缺失或过短`
  );
  assert.ok(canonical?.startsWith(`${expectedOrigin}/`), `${page}: canonical 域名错误`);
  assert.equal(openGraphUrl, canonical, `${page}: og:url 必须等于 canonical`);
  assert.ok(
    openGraphImage?.startsWith(`${expectedOrigin}/`) &&
      openGraphImage.endsWith("/og-card.png"),
    `${page}: og:image 必须是生产绝对地址`
  );
  assert.equal(twitterCard, "summary_large_image", `${page}: Twitter 卡片错误`);
  assert.ok(jsonLd, `${page}: 缺少 JSON-LD`);
  assert.doesNotThrow(() => JSON.parse(jsonLd), `${page}: JSON-LD 无效`);
  assert.equal(
    /<meta\s+name="keywords"/i.test(html),
    false,
    `${page}: 不应使用 meta keywords`
  );

  if (shouldIndex) {
    assert.match(robots, /^index,follow/, `${page}: 应允许索引`);
    assert.equal(titles.has(title), false, `${page}: title 与 ${titles.get(title)} 重复`);
    assert.equal(
      descriptions.has(description),
      false,
      `${page}: description 与 ${descriptions.get(description)} 重复`
    );
    titles.set(title, page);
    descriptions.set(description, page);
    expectedCanonicalUrls.push(canonical);
  } else {
    assert.match(robots, /^noindex,follow$/, `${page}: 应设置 noindex,follow`);
  }
}

const robots = await readFile(join(distDirectory, "robots.txt"), "utf8");
assert.match(robots, /^User-agent: \*/m);
assert.match(robots, /^Disallow: \/free\/$/m);
assert.match(
  robots,
  new RegExp(
    `^Sitemap: ${expectedOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap-index\\.xml$`,
    "m"
  )
);

const sitemapIndex = await readFile(
  join(distDirectory, "sitemap-index.xml"),
  "utf8"
);
assert.match(sitemapIndex, /sitemap-0\.xml/);
const sitemap = await readFile(join(distDirectory, "sitemap-0.xml"), "utf8");
for (const canonical of expectedCanonicalUrls) {
  assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap 缺少 ${canonical}`);
}
assert.doesNotMatch(sitemap, /\/404\/?<\/loc>/);
assert.doesNotMatch(sitemap, /\/archive\/\d{4}-\d{2}-\d{2}\/?<\/loc>/);
assert.deepEqual(
  new Set(buildIndexNowPayload(expectedOrigin).urlList),
  new Set(expectedCanonicalUrls),
  "IndexNow URL 必须与可索引 canonical 完全一致"
);

const home = await readFile(join(distDirectory, "index.html"), "utf8");
for (const keyword of ["免费 Clash", "Mihomo", "V2Ray", "每 12 小时"]) {
  assert.ok(home.includes(keyword), `首页缺少核心语义：${keyword}`);
}

console.log(
  `SEO 检查通过：${htmlFiles.length} 个 HTML，${expectedCanonicalUrls.length} 个可索引页面`
);
