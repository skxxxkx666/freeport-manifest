import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { deploymentTarget } from "./scripts/deployment-config.mjs";

const { site, base } = deploymentTarget();

export default defineConfig({
  site,
  base,
  trailingSlash: "ignore",
  integrations: [react()],
  build: { format: "directory" }
});
