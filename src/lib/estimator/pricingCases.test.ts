// Runner core tests (BRIEF-estimator-pricing-rules-stage0 §7). The fixture is
// the brief's §9.1 cases in the §7.1 format, with the brief's expected
// figures (worked out independently of calc.ts). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { runPricingCase } from "./pricingCases";

const FIXTURE: any[] = JSON.parse(
  readFileSync(new URL("./pricingCases.fixture.json", import.meta.url), "utf8")
);

test("fixture: all 22 §9.1 cases pass", () => {
  assert.equal(FIXTURE.length, 22);
  const failed = FIXTURE.map(runPricingCase).filter((r) => r.status !== "pass");
  assert.deepEqual(failed, []);
});

test("a 1-cent change to an expected value fails, naming the figures", () => {
  const c = structuredClone(FIXTURE.find((x) => x.code === "X01"));
  c.expected.costExGst = 1325.41;
  const r = runPricingCase(c);
  assert.equal(r.status, "fail");
  assert.deepEqual(r.problems, ["costExGst 1325.40, expected 1325.41"]);
});

test("segments are compared when the case gives them", () => {
  const c = structuredClone(FIXTURE.find((x) => x.code === "X01"));
  c.expected.segments[1].doublePenalty = false;
  c.expected.segments[2].rate = 99.95;
  const r = runPricingCase(c);
  assert.equal(r.status, "fail");
  assert.deepEqual(r.problems, [
    "segment 2 doublePenalty true, expected false",
    "segment 3 rate 199.9, expected 99.95",
  ]);
});

test("billableHours is compared when the case gives it", () => {
  const c = structuredClone(FIXTURE.find((x) => x.code === "C12"));
  c.expected.billableHours = 0.25;
  assert.deepEqual(runPricingCase(c).problems, ["billableHours 0.5, expected 0.25"]);
});

test("scope goat cases are skipped, not run", () => {
  const c = structuredClone(FIXTURE[0]);
  c.scope = "goat";
  c.expected.costExGst = 1; // would fail if it ran
  assert.equal(runPricingCase(c).status, "skipped");
});

test("a malformed case fails and says what's wrong", () => {
  const c = structuredClone(FIXTURE[0]);
  delete c.input.rate.day;
  c.input.settings.dayStart = "8am";
  const r = runPricingCase(c);
  assert.equal(r.status, "fail");
  assert.equal(r.code, "C01");
  assert.deepEqual(r.problems, [
    "bad case format at input.rate.day: Required",
    "bad case format at input.settings.dayStart: Invalid",
  ]);
});

test("a case whose line can't be priced fails with calc's error", () => {
  const c = structuredClone(FIXTURE[0]);
  c.input.line.startTime = "25:00";
  const r = runPricingCase(c);
  assert.equal(r.status, "fail");
  assert.ok(r.problems.some((p) => p.includes("Start time must be HH:MM")));
});
