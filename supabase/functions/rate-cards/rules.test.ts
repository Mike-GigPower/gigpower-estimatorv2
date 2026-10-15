// rate-cards response and request handling (BRIEF-estimator-pricing-rules-
// stage0 §8, acceptance 10–12). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildRules, handleRequest, secretsMatch, type RulesData } from "./rules.ts";

const STD = "00000000-0000-0000-0000-000000000001";
const AO = "aaaaaaaa-0000-0000-0000-000000000003";

const DATA: RulesData = {
  settings: {
    dayStart: "08:00",
    nightStart: "20:00",
    minBillableHours: 4,
    gstRate: 0.1,
    currency: "AUD",
    quoteText: { termsAndConditions: "long text" },
  },
  holidays: [
    { holiday_date: "2026-12-26", name: "Boxing Day" },
    { holiday_date: "2026-12-25", name: "Christmas Day" },
  ],
  windows: [
    { name: "Christmas", start_md: "12-24", start_time: "20:00", end_md: "12-25", end_time: "12:00", multiplier: "2" },
  ],
  sets: [
    { id: AO, code: "mopt-ao", name: "MOPT — Australian Open", kind: "customer", smartstaff_customer_ids: [], sort_order: 20 },
    { id: STD, code: "standard", name: "Standard", kind: "standard", smartstaff_customer_ids: [], sort_order: 0 },
  ],
  rates: [
    // PostgREST may send numerics as strings.
    { id: "r2", set_id: STD, role_name: "Standard Crew", day_rate: "65.00", night_rate: "82.00", sunday_rate: "102.50", public_holiday_rate: "102.50", ot_8_day_rate: "82.00", ot_8_night_rate: "82.00", ot_10_day_rate: "102.50", ot_10_night_rate: "102.50", min_billable_hours: null, effective_from: "2027-07-01", sort_order: 10, call_names: [] },
    { id: "r1", set_id: STD, role_name: "Standard Crew", day_rate: 63, night_rate: 79.9, sunday_rate: 99.95, public_holiday_rate: 99.95, ot_8_day_rate: 79.9, ot_8_night_rate: 79.9, ot_10_day_rate: 99.95, ot_10_night_rate: 99.95, min_billable_hours: null, effective_from: "2000-01-01", sort_order: 10, call_names: [] },
    { id: "r3", set_id: AO, role_name: "Australian Open Event Operations", day_rate: 72.14, night_rate: 72.14, sunday_rate: 98.1, public_holiday_rate: 98.1, ot_8_day_rate: null, ot_8_night_rate: null, ot_10_day_rate: 98.1, ot_10_night_rate: 98.1, min_billable_hours: "0.5", effective_from: "2000-01-01", sort_order: 10, call_names: ["Australian Open Event Operations"] },
    // A rate on an inactive set (not in `sets`) is left out.
    { id: "r4", set_id: "inactive-set", role_name: "Old", day_rate: 1, effective_from: "2000-01-01", sort_order: 0, call_names: [] },
  ],
  items: [
    { set_id: STD, code: "tolls", kind: "flat_item", charge_ex_gst: null, unit_label: "at cost", sort_order: 4 },
    { set_id: STD, code: "broadcast", kind: "per_person_per_event", charge_ex_gst: "264.80", unit_label: "per person per event", sort_order: 1 },
    { set_id: AO, code: "ao_broadcast_allowance", kind: "per_person_per_event", charge_ex_gst: 257.75, unit_label: "per person per event", sort_order: 1 },
  ],
  testCases: [
    { code: "X01", title: "t2", rule: "D31 window", scope: "both", input: { a: 1 }, expected: { costExGst: 1325.4 } },
    { code: "C01", title: "t1", rule: "Plain day", scope: "both", input: { a: 2 }, expected: { costExGst: 252 } },
  ],
  lastChanged: "2026-10-16T01:02:03.000Z",
};

const NOW = new Date("2026-10-17T00:00:00.000Z");

test("shape: schema, timestamps, settings (only the four pricing keys)", () => {
  const r = buildRules(DATA, NOW);
  assert.equal(r.schema, "rules-1");
  assert.equal(r.generated_at, "2026-10-17T00:00:00.000Z");
  assert.equal(r.last_changed, "2026-10-16T01:02:03.000Z");
  assert.deepEqual(r.settings, { dayStart: "08:00", nightStart: "20:00", minBillableHours: 4, gstRate: 0.1 });
});

test("holidays sorted by date; windows camelCase with a numeric multiplier", () => {
  const r = buildRules(DATA, NOW);
  assert.deepEqual(r.public_holidays, [
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-26", name: "Boxing Day" },
  ]);
  assert.deepEqual(r.double_penalty_windows, [
    { name: "Christmas", startMd: "12-24", startTime: "20:00", endMd: "12-25", endTime: "12:00", multiplier: 2 },
  ]);
});

test("sets in sort order, each with its own rates and items; inactive sets' rates left out", () => {
  const r = buildRules(DATA, NOW);
  assert.deepEqual(r.sets.map((s) => s.code), ["standard", "mopt-ao"]);
  assert.deepEqual(r.sets[0].items.map((i) => i.code), ["broadcast", "tolls"]);
  assert.deepEqual(r.sets[1].items.map((i) => i.code), ["ao_broadcast_allowance"]);
  assert.ok(!r.sets.flatMap((s) => s.rates).some((x) => x.role_name === "Old"));
});

test("every effective_from version is kept, oldest first", () => {
  const std = buildRules(DATA, NOW).sets[0];
  assert.deepEqual(std.rates.map((x) => x.effective_from), ["2000-01-01", "2027-07-01"]);
});

test("numbers as numbers, null stays null (acceptance 12: MOPT ot_8_day_rate is null, not 0)", () => {
  const [std, ao] = buildRules(DATA, NOW).sets;
  const future = std.rates[1];
  assert.equal(future.day_rate, 65);
  assert.equal(future.public_holiday_rate, 102.5);
  assert.equal(future.min_billable_hours, null);
  assert.equal(ao.rates[0].ot_8_day_rate, null);
  assert.equal(ao.rates[0].ot_8_night_rate, null);
  assert.equal(ao.rates[0].min_billable_hours, 0.5);
  assert.deepEqual(ao.rates[0].call_names, ["Australian Open Event Operations"]);
  assert.equal(std.items[0].charge_ex_gst, 264.8);
  assert.equal(std.items[1].charge_ex_gst, null);
});

test("test cases sorted by code, with the fields the runner needs", () => {
  assert.deepEqual(buildRules(DATA, NOW).test_cases, [
    { code: "C01", title: "t1", rule: "Plain day", scope: "both", input: { a: 2 }, expected: { costExGst: 252 } },
    { code: "X01", title: "t2", rule: "D31 window", scope: "both", input: { a: 1 }, expected: { costExGst: 1325.4 } },
  ]);
});

test("empty tables give empty lists, not errors (before Migration B)", () => {
  const r = buildRules({ ...DATA, windows: [], items: [], testCases: [], lastChanged: null }, NOW);
  assert.deepEqual(r.double_penalty_windows, []);
  assert.deepEqual(r.test_cases, []);
  assert.deepEqual(r.sets[0].items, []);
  assert.equal(r.last_changed, null);
});

// ---- request handling ------------------------------------------------------

function deps(over: Partial<Parameters<typeof handleRequest>[1]> = {}) {
  let loads = 0;
  return {
    d: {
      secret: "s3cret",
      load: async () => {
        loads++;
        return DATA;
      },
      now: () => NOW,
      ...over,
    },
    loads: () => loads,
  };
}
const req = (headers: Record<string, string> = {}, method = "GET") =>
  new Request("https://x/functions/v1/rate-cards", { method, headers });

test("right secret: 200 JSON, not cached", async () => {
  const { d } = deps();
  const res = await handleRequest(req({ "X-GOAT-Secret": "s3cret" }), d);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal((await res.json()).schema, "rules-1");
});

test("acceptance 11: no secret or a wrong one is 401, and nothing is read", async () => {
  const cases: Record<string, string>[] = [{}, { "X-GOAT-Secret": "wrong" }, { "X-GOAT-Secret": "S3CRET" }, { "X-GOAT-Secret": "" }];
  for (const h of cases) {
    const { d, loads } = deps();
    const res = await handleRequest(req(h), d);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "unauthorized" });
    assert.equal(loads(), 0);
  }
});

test("GET only: other methods are 405, even with the secret", async () => {
  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
    const { d, loads } = deps();
    const res = await handleRequest(req({ "X-GOAT-Secret": "s3cret" }, m), d);
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "GET");
    assert.equal(loads(), 0);
  }
});

test("an unset RATE_CARDS_SECRET refuses everything (never open)", async () => {
  for (const secret of [undefined, ""]) {
    const { d, loads } = deps({ secret });
    const res = await handleRequest(req({ "X-GOAT-Secret": "" }), d);
    assert.equal(res.status, 500);
    assert.equal(loads(), 0);
  }
});

test("a failed read is a 500 that says nothing about the data", async () => {
  const { d } = deps({
    load: async () => {
      throw new Error('relation "rate_items" does not exist');
    },
  });
  const orig = console.error;
  console.error = () => {};
  try {
    const res = await handleRequest(req({ "X-GOAT-Secret": "s3cret" }), d);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "couldn't read the rules" });
  } finally {
    console.error = orig;
  }
});

test("secretsMatch: exact match only", async () => {
  assert.equal(await secretsMatch("abc", "abc"), true);
  assert.equal(await secretsMatch("abd", "abc"), false);
  assert.equal(await secretsMatch("abcd", "abc"), false);
  assert.equal(await secretsMatch("", "abc"), false);
});
