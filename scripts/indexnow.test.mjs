import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIndexNowPayload,
  indexNowKey,
  submitIndexNow
} from "./indexnow.mjs";

test("IndexNow payload only contains canonical production pages", () => {
  const payload = buildIndexNowPayload("https://manifest.dpdns.org/");

  assert.equal(payload.host, "manifest.dpdns.org");
  assert.equal(
    payload.keyLocation,
    `https://manifest.dpdns.org/${indexNowKey}.txt`
  );
  assert.deepEqual(payload.urlList, [
    "https://manifest.dpdns.org/",
    "https://manifest.dpdns.org/today/",
    "https://manifest.dpdns.org/archive/",
    "https://manifest.dpdns.org/faq/",
    "https://manifest.dpdns.org/upgrade/"
  ]);
});

test("IndexNow accepts initial verification responses", async () => {
  let request;
  const result = await submitIndexNow({
    siteUrl: "https://manifest.dpdns.org",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response("", { status: 202 });
    }
  });

  assert.equal(result.status, 202);
  assert.equal(result.submitted, 5);
  assert.equal(request.url, "https://api.indexnow.org/indexnow");
  assert.equal(request.options.method, "POST");
  assert.equal(JSON.parse(request.options.body).host, "manifest.dpdns.org");
});
