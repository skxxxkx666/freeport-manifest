import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { readdirSync, readFileSync } from "node:fs";
import { deploymentTarget } from "./scripts/deployment-config.mjs";

const { site, base } = deploymentTarget();
const manifestDirectory = new URL("./src/content/subs/", import.meta.url);
const latestManifestFile = readdirSync(manifestDirectory)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
  .sort()
  .at(-1);

if (!latestManifestFile) {
  throw new Error("sitemap 无法找到最新运单");
}

const latestManifest = readFileSync(
  new URL(latestManifestFile, manifestDirectory),
  "utf8"
);
const issuedAt = latestManifest.match(/^issuedAt:\s*["']([^"']+)["']/m)?.[1];
const manifestLastmod = issuedAt ? new Date(issuedAt) : new Date(Number.NaN);

if (Number.isNaN(manifestLastmod.getTime())) {
  throw new Error(`sitemap 无法读取 ${latestManifestFile} 的 issuedAt`);
}

const publicRoot = new URL(`${base.replace(/\/$/, "")}/`, `${site}/`);
const frequentlyUpdatedPages = new Map([
  [new URL("", publicRoot).href, "hourly"],
  [new URL("today/", publicRoot).href, "hourly"],
  [new URL("archive/", publicRoot).href, "daily"]
]);

export default defineConfig({
  site,
  base,
  trailingSlash: "ignore",
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/+$/, "");
        return (
          !/\/404$/.test(path) &&
          !/\/archive\/\d{4}-\d{2}-\d{2}$/.test(path)
        );
      },
      serialize: (item) => {
        const changefreq = frequentlyUpdatedPages.get(item.url);
        return changefreq
          ? { ...item, lastmod: manifestLastmod, changefreq }
          : item;
      }
    })
  ],
  build: { format: "directory" }
});
