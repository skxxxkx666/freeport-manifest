import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const subs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/subs" }),
  schema: z.object({
    date: z.preprocess(
      (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
      z.string()
    ),                                // 运单号来源 FP-YYYYMMDD-<serial>
    serial: z.string().default("01"),
    issuedAt: z.string(),
    clash: z.url(),
    v2ray: z.url(),
    nodeCount: z.number(),
    regions: z.array(z.string()),
    protocols: z.array(z.string()),
    breakdown: z
      .array(z.object({ region: z.string(), protocol: z.string(), count: z.number() }))
      .optional(),
    alive: z.number().min(0).max(1).optional(),
    note: z.string().optional(),
    expired: z.boolean().default(false)
  })
});

export const collections = { subs };
