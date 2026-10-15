// Pricing-rule tests (BRIEF-estimator-pricing-rules-stage0 §5, §9.1): D31
// double-penalty windows and the S-3 per-role minimum. Expected figures are the brief's, worked out
// independently of calc.ts. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateLabourLine, minBillableHoursFor } from "./calc";
import { mapRateCardRow } from "../rateCards";
import type { AppConfig, DoublePenaltyWindow, RateRow } from "../types";

function rate(
  role: string,
  r: Pick<RateRow, "day" | "night" | "sunday" | "publicHoliday" | "over8" | "over10">
): RateRow {
  return { role, ...r, setCode: "standard", callNames: [], effectiveFrom: "2000-01-01" };
}

const STD = rate("Standard Crew", { day: 63, night: 79.9, sunday: 99.95, publicHoliday: 99.95, over8: 79.9, over10: 99.95 });
const EVENT_OPS = rate("Event Operations", { day: 69.6, night: 69.6, sunday: 95.45, publicHoliday: 95.45, over8: null, over10: 95.45 });
const TRAINING: RateRow = {
  ...rate("Online or Onsite Training", { day: 69.6, night: 69.6, sunday: 95.45, publicHoliday: 95.45, over8: null, over10: 95.45 }),
  minBillableHours: 0.5,
};
const SHOW = rate("Show Crew", { day: 84.5, night: 84.5, sunday: 99.95, publicHoliday: 99.95, over8: 84.5, over10: 84.5 });

const WINDOWS: DoublePenaltyWindow[] = [
  { name: "Christmas", startMd: "12-24", startTime: "20:00", endMd: "12-25", endTime: "12:00", multiplier: 2 },
  { name: "New Year", startMd: "12-31", startTime: "20:00", endMd: "01-01", endTime: "12:00", multiplier: 2 },
];

function config(windows: DoublePenaltyWindow[]): AppConfig {
  return {
    currency: "AUD",
    gstRate: 0.1,
    minBillableHours: 4,
    dayStart: "08:00",
    nightStart: "20:00",
    rates: [STD, SHOW, EVENT_OPS, TRAINING],
    publicHolidays: ["2026-11-03", "2026-12-25", "2026-12-26", "2026-12-28", "2027-01-01"].map((date) => ({
      date,
      label: "",
    })),
    doublePenaltyWindows: windows,
    quoteText: { termsAndConditions: "" },
  };
}

function cost(
  role: string,
  shiftDate: string,
  startTime: string,
  durationHours: number,
  windows = WINDOWS,
  qty = 1
) {
  const r = calculateLabourLine({ id: "t", role, shiftDate, startTime, durationHours, qty }, config(windows));
  assert.deepEqual(r.errors, []);
  return r;
}

test("X01: window starts 20:00 on 24 Dec — Std 24 Dec 18:00, 8h = $1,325.40", () => {
  assert.equal(cost("Standard Crew", "2026-12-24", "18:00", 8).costExGst, 1325.4);
});

test("X02: window ends 12:00 on 25 Dec, then ordinary PH — Std 25 Dec 10:00, 4h = $599.70", () => {
  assert.equal(cost("Standard Crew", "2026-12-25", "10:00", 4).costExGst, 599.7);
});

test("X03: NYE window — Std 31 Dec 22:00, 4h = $799.60", () => {
  assert.equal(cost("Standard Crew", "2026-12-31", "22:00", 4).costExGst, 799.6);
});

test("X04: substitute holiday is not doubled — Std Mon 28 Dec 10:00, 4h = $399.80", () => {
  assert.equal(cost("Standard Crew", "2026-12-28", "10:00", 4).costExGst, 399.8);
});

test("X05: Boxing Day is ordinary PH — Std Sat 26 Dec 10:00, 4h = $399.80", () => {
  assert.equal(cost("Standard Crew", "2026-12-26", "10:00", 4).costExGst, 399.8);
});

test("X06: window beats overtime — Std 24 Dec 12:00, 12h = $1,303.60", () => {
  assert.equal(cost("Standard Crew", "2026-12-24", "12:00", 12).costExGst, 1303.6);
});

test("X07: NYE window ends 12:00 on 1 Jan (crosses the year) — Std 1 Jan 2027 10:00, 4h = $599.70", () => {
  assert.equal(cost("Standard Crew", "2027-01-01", "10:00", 4).costExGst, 599.7);
});

test("X08: window uses the role's own PH rate — Show 24 Dec 20:00, 4h = $799.60", () => {
  assert.equal(cost("Show Crew", "2026-12-24", "20:00", 4).costExGst, 799.6);
});

test("X09: 24 Dec before 20:00 is an ordinary day — Std 24 Dec 14:00, 4h = $252.00", () => {
  assert.equal(cost("Standard Crew", "2026-12-24", "14:00", 4).costExGst, 252);
});

test("X01 segments: 20:00–02:00 flagged Christmas ×2 and they reconcile with the line", () => {
  const r = cost("Standard Crew", "2026-12-24", "18:00", 8, WINDOWS, 3);
  const flagged = r.segments.filter((s) => s.doublePenalty);
  assert.deepEqual(
    flagged.map((s) => [s.dateISO, s.period, s.hours, s.rate, s.windowName, s.multiplier]),
    [
      ["2026-12-24", "night", 4, 199.9, "Christmas", 2],
      ["2026-12-25", "night", 2, 199.9, "Christmas", 2],
    ]
  );
  const unflagged = r.segments.filter((s) => !s.doublePenalty);
  assert.ok(unflagged.every((s) => !("doublePenalty" in s) && !("windowName" in s)));
  const perCrew = r.segments.reduce((a, s) => a + s.costExGst, 0);
  assert.equal(Math.round(perCrew * 3 * 100) / 100, r.costExGst);
});

test("no windows: the same shifts price as before (no doubling, no extra cuts)", () => {
  // 2 × 63 + 4 × 79.90 + 2 × 99.95 (PH from midnight)
  const x01 = cost("Standard Crew", "2026-12-24", "18:00", 8, []);
  assert.equal(x01.costExGst, 645.5);
  assert.ok(x01.segments.every((s) => !("doublePenalty" in s)));
  // 25 Dec 10:00–14:00 stays one PH day segment: no cut at 12:00.
  const x02 = cost("Standard Crew", "2026-12-25", "10:00", 4, []);
  assert.equal(x02.costExGst, 399.8);
  assert.equal(x02.segments.length, 1);
  // NYE 22:00–02:00: 2 × 79.90 + 2 × 99.95
  assert.equal(cost("Standard Crew", "2026-12-31", "22:00", 4, []).costExGst, 359.7);
});

test("a window with multiplier ≤ 1 or a malformed date prices nothing extra", () => {
  const bad: DoublePenaltyWindow[] = [
    { ...WINDOWS[0], multiplier: 1 },
    { ...WINDOWS[1], startMd: "31-12" },
  ];
  assert.equal(cost("Standard Crew", "2026-12-24", "18:00", 8, bad).costExGst, 645.5);
  assert.equal(cost("Standard Crew", "2026-12-31", "22:00", 4, bad).costExGst, 359.7);
});

// ---- S-3: per-role minimum -------------------------------------------------

test("C11: per-role minimum — 1h of Training (min 0.5) bills 1h = $69.60", () => {
  const r = cost("Online or Onsite Training", "2026-10-14", "10:00", 1);
  assert.equal(r.costExGst, 69.6);
  assert.equal(r.billableHours, 1);
});

test("C12: per-role minimum applies below it — 0.25h of Training bills 0.5h = $34.80", () => {
  const r = cost("Online or Onsite Training", "2026-10-14", "10:00", 0.25);
  assert.equal(r.costExGst, 34.8);
  assert.equal(r.billableHours, 0.5);
});

test("C13: no per-role minimum → the global 4h — 1h of Event Operations = $278.40", () => {
  const r = cost("Event Operations", "2026-10-14", "10:00", 1);
  assert.equal(r.costExGst, 278.4);
  assert.equal(r.billableHours, 4);
});

test("minBillableHoursFor: the role's own minimum, else the global one", () => {
  const rates = [STD, TRAINING];
  assert.equal(minBillableHoursFor("Online or Onsite Training", "2026-10-14", rates, 4), 0.5);
  assert.equal(minBillableHoursFor("Standard Crew", "2026-10-14", rates, 4), 4);
  assert.equal(minBillableHoursFor("Unknown", "2026-10-14", rates, 4), 4);
});

test("loader mapping: a null min_billable_hours stays null, never 0", () => {
  const row = {
    role_name: "R", day_rate: 1, night_rate: 1, sunday_rate: 1, public_holiday_rate: 1,
    ot_8_day_rate: null, ot_10_day_rate: 1, effective_from: "2000-01-01", sort_order: 0, call_names: [],
  };
  assert.equal(mapRateCardRow({ ...row, min_billable_hours: null }, "standard").minBillableHours, null);
  assert.equal(mapRateCardRow(row, "standard").minBillableHours, null);
  assert.equal(mapRateCardRow({ ...row, min_billable_hours: "0.5" }, "standard").minBillableHours, 0.5);
});
