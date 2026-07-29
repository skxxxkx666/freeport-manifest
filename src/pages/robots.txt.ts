import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL("https://manifest.dpdns.org");
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const sitemap = new URL(`${base}sitemap-index.xml`, origin).href;
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /free/",
      "",
      `Sitemap: ${sitemap}`,
      ""
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    }
  );
};
