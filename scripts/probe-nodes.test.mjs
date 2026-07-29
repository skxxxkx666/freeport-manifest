import test from "node:test";
import assert from "node:assert/strict";
import {
  assertProbeThreshold,
  probeFailureReason,
  selectSpeedCandidates,
  summarizeProbeResults
} from "./probe-nodes.mjs";

test("probe result summary reports latency and failure distribution", () => {
  const summary = summarizeProbeResults(
    [
      { name: "a", type: "ss", alive: true, delayMs: 80 },
      { name: "b", type: "trojan", alive: true, delayMs: 240 },
      { name: "c", type: "vless", alive: false, reason: "timeout" }
    ],
    "2026-07-30T00:00:00.000Z"
  );

  assert.equal(summary.healthyCount, 2);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.aliveRatio, 2 / 3);
  assert.deepEqual(summary.latencyMs, {
    min: 80,
    median: 160,
    p95: 232,
    max: 240
  });
  assert.deepEqual(summary.failureReasons, { timeout: 1 });
});

test("probe threshold requires both count and ratio", () => {
  assert.doesNotThrow(() =>
    assertProbeThreshold({ healthyCount: 6, candidateCount: 20, aliveRatio: 0.3 })
  );
  assert.throws(
    () =>
      assertProbeThreshold({
        healthyCount: 4,
        candidateCount: 20,
        aliveRatio: 0.2
      }),
    /健康门槛未通过/
  );
  assert.throws(
    () =>
      assertProbeThreshold({
        healthyCount: 5,
        candidateCount: 40,
        aliveRatio: 0.125
      }),
    /健康门槛未通过/
  );
});

test("probe failures are normalized without exposing endpoints", () => {
  assert.equal(probeFailureReason("context deadline exceeded"), "timeout");
  assert.equal(probeFailureReason("x509 certificate error"), "tls-or-handshake");
  assert.equal(probeFailureReason("connect: connection refused"), "connection-refused");
});

test("speed samples prefer protocol diversity before retrying one protocol", () => {
  const candidates = selectSpeedCandidates(
    [
      { name: "vless-fast", type: "vless", alive: true, delayMs: 20 },
      { name: "vless-second", type: "vless", alive: true, delayMs: 30 },
      { name: "trojan", type: "trojan", alive: true, delayMs: 60 },
      { name: "ss", type: "ss", alive: true, delayMs: 80 },
      { name: "dead", type: "vmess", alive: false, delayMs: null }
    ],
    4
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.name),
    ["vless-fast", "trojan", "ss", "vless-second"]
  );
});
