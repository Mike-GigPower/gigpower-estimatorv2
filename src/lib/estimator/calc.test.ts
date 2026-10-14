// Rate-card pricing tests (BRIEF-estimator-customer-rate-cards §10, tests 2–9,
// plus "no 8-hour tier" equivalence and the §5.3 card-switch rules).
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateQuoteTotals, normaliseInputRoles } from "./calc";
import { ratesForQuote } from "../rateCards";
import { buildCrewFinderPayload } from "../crewfinderExport";
import {
  roleForCallName,
  type AppConfig,
  type CrewFinderCallName,
  type QuoteInput,
  type QuoteRateCard,
  type RateRow,
} from "../types";

function rate(
  setCode: string,
  role: string,
  r: Pick<RateRow, "day" | "night" | "sunday" | "publicHoliday" | "over8" | "over10">,
  callNames: string[] = []
): RateRow {
  return { role, ...r, setCode, callNames, effectiveFrom: "2000-01-01" };
}

const EVENT_OPS_CALLS = ["Load In", "Load Out", "LX", "SX", "VX", "Backline", "Site", "Utility", "General"];

// Standard: live values (Oct 2026). MOPT: Migration B. ot_8 null = no 8h tier.
const RATES: RateRow[] = [
  rate("standard", "Standard Crew", { day: 63, night: 79.9, sunday: 99.95, publicHoliday: 99.95, over8: 79.9, over10: 99.95 }),
  rate("standard", "Show Crew", { day: 84.5, night: 84.5, sunday: 99.95, publicHoliday: 99.95, over8: 84.5, over10: 84.5 }),
  rate("standard", "Fork/Truck/EWP", { day: 69.5, night: 89.6, sunday: 106.8, publicHoliday: 106.8, over8: 89.6, over10: 106.8 }),
  rate("mopt", "Event Operations", { day: 69.6, night: 69.6, sunday: 95.45, publicHoliday: 95.45, over8: null, over10: 95.45 }, EVENT_OPS_CALLS),
  rate("mopt", "Forklift Driver", { day: 77.43, night: 77.43, sunday: 103.87, publicHoliday: 103.87, over8: null, over10: 103.87 }, ["Fork", "Truck", "EWP"]),
  rate("mopt", "Online or Onsite Training", { day: 69.6, night: 69.6, sunday: 95.45, publicHoliday: 95.45, over8: null, over10: 95.45 }, ["Training"]),
  rate("mopt-ao", "Australian Open Event Operations", { day: 72.14, night: 72.14, sunday: 98.1, publicHoliday: 98.1, over8: null, over10: 98.1 }, EVENT_OPS_CALLS),
  rate("mopt-ao", "Australian Open Online or Onsite Training", { day: 72.14, night: 72.14, sunday: 98.1, publicHoliday: 98.1, over8: null, over10: 98.1 }, ["Training"]),
  rate("mopt-ao", "Field of Play Operations", { day: 87.9, night: 87.9, sunday: 98.1, publicHoliday: 98.1, over8: null, over10: 98.1 }, ["Field of Play"]),
];

const CONFIG: AppConfig = {
  currency: "AUD",
  gstRate: 0.1,
  minBillableHours: 4,
  dayStart: "08:00",
  nightStart: "20:00",
  rates: RATES,
  publicHolidays: [],
  quoteText: { termsAndConditions: "" },
};

const MON = "2026-07-06";
const TUE = "2026-07-07";
const WED = "2026-07-08";
const SUN = "2026-07-12";

const STANDARD: QuoteRateCard | undefined = undefined;
const MOPT_NO: QuoteRateCard = { mopt: true, australianOpen: false };
const MOPT_YES: QuoteRateCard = { mopt: true, australianOpen: true };

function quote(
  rateCard: QuoteRateCard | undefined,
  lines: Array<{ callName: CrewFinderCallName; date: string; start: string; hours: number; qty: number }>
): QuoteInput {
  const cardRates = ratesForQuote(CONFIG, rateCard);
  return {
    quoteNumber: "",
    quoteDate: "",
    validUntil: "",
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    venue: "",
    notes: "",
    rateCard,
    labour: lines.map((l, i) => ({
      id: `l${i + 1}`,
      callName: l.callName,
      role: roleForCallName(l.callName, cardRates),
      qty: l.qty,
      shiftDate: l.date,
      startTime: l.start,
      durationHours: l.hours,
    })),
    nonLabour: [],
  };
}

// Price as the quote screen does: against Standard + the quote's card.
function price(input: QuoteInput) {
  const cardRates = ratesForQuote(CONFIG, input.rateCard);
  assert.ok(cardRates, "quote should be priceable");
  const result = calculateQuoteTotals(input, { ...CONFIG, rates: cardRates });
  assert.deepEqual(result.validationErrors, []);
  return result;
}

test("2: no MOPT — Load In, Mon 08:00, 8h × 5 = $2,520.00 (Standard Crew 63.00)", () => {
  const q = quote(STANDARD, [{ callName: "Load In", date: MON, start: "08:00", hours: 8, qty: 5 }]);
  assert.equal(q.labour[0].role, "Standard Crew");
  assert.equal(price(q).totals.labourExGst, 2520);
});

test("3: MOPT / AO No — Load In, Mon 08:00, 8h × 5 = $2,784.00 (Event Operations 69.60)", () => {
  const q = quote(MOPT_NO, [{ callName: "Load In", date: MON, start: "08:00", hours: 8, qty: 5 }]);
  assert.equal(q.labour[0].role, "Event Operations");
  assert.equal(price(q).totals.labourExGst, 2784);
});

test("4: MOPT / No — General, Tue 22:00, 4h × 2 = $556.80 (no night loading)", () => {
  const q = quote(MOPT_NO, [{ callName: "General", date: TUE, start: "22:00", hours: 4, qty: 2 }]);
  assert.equal(price(q).totals.labourExGst, 556.8);
});

test("5: MOPT / No — General, Wed 08:00, 11h × 1 = $791.45 (nothing extra at 8h)", () => {
  const q = quote(MOPT_NO, [{ callName: "General", date: WED, start: "08:00", hours: 11, qty: 1 }]);
  assert.equal(price(q).totals.labourExGst, 791.45);
});

test("6: MOPT / No — General, Sun 08:00, 8h × 1 = $763.60", () => {
  const q = quote(MOPT_NO, [{ callName: "General", date: SUN, start: "08:00", hours: 8, qty: 1 }]);
  assert.equal(price(q).totals.labourExGst, 763.6);
});

test("7: MOPT / No — FOH Spot, Mon 18:00, 5h × 1 = $422.50 (Show 84.50, the Other clause)", () => {
  const q = quote(MOPT_NO, [{ callName: "FOH Spot", date: MON, start: "18:00", hours: 5, qty: 1 }]);
  assert.equal(q.labour[0].role, "Show Crew");
  assert.equal(price(q).totals.labourExGst, 422.5);
});

test("8: MOPT / Yes — Field of Play, Mon 08:00, 9h × 1 = $791.10 (87.90)", () => {
  const q = quote(MOPT_YES, [{ callName: "Field of Play", date: MON, start: "08:00", hours: 9, qty: 1 }]);
  assert.equal(q.labour[0].role, "Field of Play Operations");
  assert.equal(price(q).totals.labourExGst, 791.1);
});

test("9: MOPT / Yes — Field of Play, Mon 08:00, 11h × 1 = $977.10 (10 × 87.90 + 98.10)", () => {
  const q = quote(MOPT_YES, [{ callName: "Field of Play", date: MON, start: "08:00", hours: 11, qty: 1 }]);
  assert.equal(price(q).totals.labourExGst, 977.1);
});

test("over8: null prices the same as over8 equal to the base rate", () => {
  const withTier = (over8: number | null): AppConfig => ({
    ...CONFIG,
    rates: [rate("mopt", "Event Operations", { day: 69.6, night: 69.6, sunday: 95.45, publicHoliday: 95.45, over8, over10: 95.45 })],
  });
  // Day, night-crossing and Sunday shifts, all into the 8–10h band.
  const q = quote(MOPT_NO, [
    { callName: "General", date: WED, start: "08:00", hours: 11, qty: 1 },
    { callName: "General", date: TUE, start: "14:00", hours: 10, qty: 3 },
    { callName: "General", date: SUN, start: "08:00", hours: 9, qty: 1 },
  ]);
  const a = calculateQuoteTotals(q, withTier(null));
  const b = calculateQuoteTotals(q, withTier(69.6));
  assert.deepEqual(a.validationErrors, []);
  assert.deepEqual(a.labourLines.map((l) => l.costExGst), b.labourLines.map((l) => l.costExGst));
  assert.equal(a.totals.labourExGst, b.totals.labourExGst);
});

test("AO unanswered: the quote has no rates (not priceable)", () => {
  assert.equal(ratesForQuote(CONFIG, { mopt: true, australianOpen: null }), null);
});

test("Standard quotes never see customer rows", () => {
  const roles = ratesForQuote(CONFIG, STANDARD)!.map((r) => r.role);
  assert.deepEqual(roles, ["Standard Crew", "Show Crew", "Fork/Truck/EWP"]);
});

test("11: Field of Play line under AO = No is kept, not rewritten, and doesn't price", () => {
  const q = quote(MOPT_YES, [{ callName: "Field of Play", date: MON, start: "08:00", hours: 9, qty: 1 }]);
  const switched = normaliseInputRoles({ ...q, rateCard: MOPT_NO }, CONFIG, { rederive: true });
  assert.equal(switched.labour[0].callName, "Field of Play");
  assert.equal(switched.labour[0].role, "Field of Play Operations");
  const result = calculateQuoteTotals(switched, { ...CONFIG, rates: ratesForQuote(CONFIG, MOPT_NO)! });
  assert.equal(result.isValid, false);
});

test("12: unticking MOPT returns Load In to Standard Crew, never the first role", () => {
  const q = quote(MOPT_NO, [{ callName: "Load In", date: MON, start: "08:00", hours: 8, qty: 5 }]);
  const unticked = normaliseInputRoles(
    { ...q, rateCard: { mopt: false, australianOpen: null } },
    CONFIG,
    { rederive: true }
  );
  assert.equal(unticked.labour[0].role, "Standard Crew");
  assert.equal(price(unticked).totals.labourExGst, 2520);
});

test("saved quotes keep a stored role that is still on the card", () => {
  // e.g. a Wardrobe line saved before Wardrobe was remapped (DECISIONS.md).
  const q = quote(STANDARD, [{ callName: "Load In", date: MON, start: "08:00", hours: 8, qty: 1 }]);
  q.labour[0].role = "Fork/Truck/EWP";
  assert.equal(normaliseInputRoles(q, CONFIG).labour[0].role, "Fork/Truck/EWP");
});

test("16: export carries schema 1.2 and the rate card", () => {
  const q = quote(MOPT_YES, [{ callName: "Load In", date: MON, start: "08:00", hours: 8, qty: 1 }]);
  const payload = buildCrewFinderPayload(q, {
    estimateId: "e",
    version: 1,
    createdAt: "",
    approvedAt: "",
    createdBy: "",
    approvedBy: "",
    config: CONFIG,
  });
  assert.equal(payload.schema_version, "1.2");
  assert.deepEqual(payload.rate_card, { set_code: "mopt-ao", mopt: true, australian_open: true });

  const std = buildCrewFinderPayload(quote(STANDARD, []), {
    estimateId: "e", version: 1, createdAt: "", approvedAt: "", createdBy: "", approvedBy: "", config: CONFIG,
  });
  assert.deepEqual(std.rate_card, { set_code: "standard", mopt: false, australian_open: null });

  assert.throws(() =>
    buildCrewFinderPayload({ ...q, rateCard: { mopt: true, australianOpen: null } }, {
      estimateId: "e", version: 1, createdAt: "", approvedAt: "", createdBy: "", approvedBy: "", config: CONFIG,
    })
  );
});
