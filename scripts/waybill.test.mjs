import test from "node:test";
import assert from "node:assert/strict";
import {
  chinaDateTime,
  chinaTime,
  untilNextIssue
} from "../src/lib/waybill.ts";

test("countdown targets the next 04:17 or 16:17 China Standard Time issue", () => {
  assert.equal(
    untilNextIssue(new Date("2026-07-30T08:16:59Z")),
    "00:00:01"
  );
  assert.equal(
    untilNextIssue(new Date("2026-07-30T08:17:00Z")),
    "12:00:00"
  );
  assert.equal(
    untilNextIssue(new Date("2026-07-30T20:16:59Z")),
    "00:00:01"
  );
  assert.equal(
    untilNextIssue(new Date("2026-07-30T20:17:00Z")),
    "12:00:00"
  );
});

test("issue timestamps are rendered in China Standard Time", () => {
  assert.equal(chinaDateTime("2026-07-30T21:02:42Z"), "2026-07-31 05:02");
  assert.equal(chinaTime("2026-07-30T04:00:00+08:00"), "04:00");
});
