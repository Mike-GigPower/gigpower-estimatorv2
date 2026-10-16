// Non-labour items (BRIEF-estimator-pricing-rules-stage0 §6.1–6.2,
// acceptance 13–14). Data as Migration B. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultConfig } from "./config";
import { itemsForQuote, mapRateItemRow } from "./rateCards";
import type { AppConfig, QuoteRateCard, RateItem } from "./types";

function item(setCode: string, code: string, name: string, kind: RateItem["kind"], charge: number | null, unitLabel: string, sortOrder: number, effectiveFrom = "2000-01-01"): RateItem {
  return { setCode, code, name, kind, chargeExGst: charge, unitLabel, sortOrder, effectiveFrom };
}

const ITEMS: RateItem[] = [
  item("standard", "broadcast", "Broadcast", "per_person_per_event", 264.8, "per person per event", 1),
  item("standard", "travel", "Travel", "travel_per_hour", 63, "per hour", 2),
  item("standard", "harness_hire", "Harness Hire", "flat_item", 80, "each", 3),
  item("standard", "tolls", "Tolls", "flat_item", null, "at cost", 4),
  item("mopt-ao", "ao_broadcast_allowance", "Australian Open Broadcast Allowance", "per_person_per_event", 257.75, "per person per event", 1),
];

const CONFIG: AppConfig = { ...defaultConfig, rateItems: ITEMS };
const TODAY = "2026-10-16";
const STANDARD: QuoteRateCard | undefined = undefined;
const MOPT_NO: QuoteRateCard = { mopt: true, australianOpen: false };
const MOPT_YES: QuoteRateCard = { mopt: true, australianOpen: true };
const codes = (items: RateItem[] | null) => items?.map((i) => i.code) ?? null;

test("13: a Standard quote offers Broadcast, Harness Hire, Tolls — no Travel, no AO allowance", () => {
  assert.deepEqual(codes(itemsForQuote(CONFIG, STANDARD, TODAY)), ["broadcast", "harness_hire", "tolls"]);
});

test("14: an MOPT AO quote also offers the AO Broadcast Allowance, after Standard's", () => {
  assert.deepEqual(codes(itemsForQuote(CONFIG, MOPT_YES, TODAY)), [
    "broadcast",
    "harness_hire",
    "tolls",
    "ao_broadcast_allowance",
  ]);
});

test("MOPT Year Round has no items of its own: Standard's only", () => {
  assert.deepEqual(codes(itemsForQuote(CONFIG, MOPT_NO, TODAY)), ["broadcast", "harness_hire", "tolls"]);
});

test("nothing is offered while the card isn't chosen, or when the items didn't load", () => {
  assert.equal(itemsForQuote(CONFIG, { mopt: true, australianOpen: null }, TODAY), null);
  assert.equal(itemsForQuote({ ...CONFIG, rateItems: null }, STANDARD, TODAY), null);
});

test("the version in effect on the date is offered; a future one isn't yet", () => {
  const config = {
    ...CONFIG,
    rateItems: [
      ...ITEMS,
      item("standard", "harness_hire", "Harness Hire", "flat_item", 85, "each", 3, "2026-10-01"),
      item("standard", "harness_hire", "Harness Hire", "flat_item", 90, "each", 3, "2027-07-01"),
    ],
  };
  const harness = (d: string) => itemsForQuote(config, STANDARD, d)!.find((i) => i.code === "harness_hire")!.chargeExGst;
  assert.equal(harness("2026-09-30"), 80);
  assert.equal(harness(TODAY), 85);
  assert.equal(harness("2027-07-01"), 90);
});

test("loader mapping: numbers as numbers, a null charge stays null (at cost)", () => {
  const row = { code: "tolls", name: "Tolls", kind: "flat_item", unit_label: "at cost", effective_from: "2000-01-01", sort_order: 4 };
  assert.equal(mapRateItemRow({ ...row, charge_ex_gst: null }, "standard").chargeExGst, null);
  assert.equal(mapRateItemRow({ ...row, charge_ex_gst: "264.80" }, "standard").chargeExGst, 264.8);
  assert.equal(mapRateItemRow({ ...row, charge_ex_gst: null }, "mopt-ao").setCode, "mopt-ao");
});
