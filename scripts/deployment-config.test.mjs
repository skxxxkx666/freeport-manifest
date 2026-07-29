import test from "node:test";
import assert from "node:assert/strict";
import { deploymentTarget } from "./deployment-config.mjs";

test("derives a GitHub project Pages target from GITHUB_REPOSITORY", () => {
  assert.deepEqual(deploymentTarget({ GITHUB_REPOSITORY: "FreedomPort/manifest" }), {
    site: "https://freedomport.github.io",
    base: "/manifest"
  });
});

test("uses root base for an account Pages repository", () => {
  assert.deepEqual(
    deploymentTarget({ GITHUB_REPOSITORY: "freedomport/freedomport.github.io" }),
    {
      site: "https://freedomport.github.io",
      base: "/"
    }
  );
});

test("custom site and base override GitHub defaults", () => {
  assert.deepEqual(
    deploymentTarget({
      GITHUB_REPOSITORY: "freedomport/manifest",
      SITE_URL: "https://manifest.freedomport.cc/",
      BASE_PATH: "/release/"
    }),
    {
      site: "https://manifest.freedomport.cc",
      base: "/release"
    }
  );
});

test("custom domains and local builds default to root base", () => {
  assert.deepEqual(deploymentTarget({ SITE_URL: "https://manifest.freedomport.cc/" }), {
    site: "https://manifest.freedomport.cc",
    base: "/"
  });
  assert.deepEqual(deploymentTarget({}), {
    site: "http://localhost:4321",
    base: "/"
  });
});
