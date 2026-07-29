import test from "node:test";
import assert from "node:assert/strict";
import { untilNextIssue } from "../src/lib/waybill.ts";

test("countdown targets the next 04:00 or 16:00 China Standard Time issue", () => {
  assert.equal(
    untilNextIssue(new Date("2026-07-30T07:59:59Z")),
    "00:00:01"
  );
  assert.equal(
    untilNextIssue(new Date("2026-07-30T08:00:00Z")),
    "12:00:00"
  );
  assert.equal(
    untilNextIssue(new Date("2026-07-30T19:59:59Z")),
    "00:00:01"
  );
  assert.equal(
    untilNextIssue(new Date("2026-07-30T20:00:00Z")),
    "12:00:00"
  );
});
