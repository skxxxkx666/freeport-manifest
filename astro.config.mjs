import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { deploymentTarget } from "./scripts/deployment-config.mjs";

const { site, base } = deploymentTarget();

export default defineConfig({
  site,
  base,
  trailingSlash: "ignore",
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/+$/, "");
        return (
          !/\/404$/.test(path) &&
          !/\/archive\/\d{4}-\d{2}-\d{2}$/.test(path)
        );
      }
    })
  ],
  build: { format: "directory" }
});
