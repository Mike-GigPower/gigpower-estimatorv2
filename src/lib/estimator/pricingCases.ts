// Shared pricing test cases (D33, BRIEF-estimator-pricing-rules-stage0 §7).
//
// Each case carries its own rates, settings, holidays and windows, so it
// checks the maths, not today's prices. Both calc.ts and THE GOAT's
// estimator_calc.py must pass every case. scripts/pricing-tests.ts fetches
// the cases and runs them here before every build.
import { z } from "zod";

import { calculateLabourLine } from "./calc";
import { STANDARD_SET_CODE, type AppConfig } from "../types";

// The rate row every case is priced against.
const CASE_ROLE = "T";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const md = z.string().regex(/^\d{2}-\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite();

const caseInputSchema = z.object({
  rate: z.object({
    day: money,
    night: money,
    sunday: money,
    publicHoliday: money,
    // null = no such tier (like the M&OP rows).
    over8: money.nullable(),
    over10: money.nullable(),
    // Optional per-role minimum (S-3); overrides settings.minBillableHours.
    minBillableHours: z.number().positive().nullable().optional(),
  }),
  settings: z.object({
    dayStart: hhmm,
    nightStart: hhmm,
    minBillableHours: z.number().nonnegative(),
  }),
  publicHolidays: z.array(isoDate),
  doublePenaltyWindows: z
    .array(
      z.object({
        name: z.string(),
        startMd: md,
        startTime: hhmm,
        endMd: md,
        endTime: hhmm,
        multiplier: z.number().gt(1),
      })
    )
    .default([]),
  line: z.object({
    shiftDate: isoDate,
    startTime: z.string(),
    durationHours: z.number().positive(),
    qty: z.number().positive(),
  }),
});

const expectedSegmentSchema = z.object({
  tier: z.enum(["base", "ot8", "ot10"]),
  period: z.enum(["day", "night"]),
  dateISO: isoDate,
  hours: z.number(),
  rate: money,
  costExGst: money,
  doublePenalty: z.boolean().optional(),
});

const caseExpectedSchema = z.object({
  costExGst: money,
  billableHours: z.number().optional(),
  segments: z.array(expectedSegmentSchema).optional(),
});

export const pricingCaseSchema = z.object({
  code: z.string().min(1),
  title: z.string().optional(),
  rule: z.string().optional(),
  scope: z.enum(["both", "goat"]),
  input: caseInputSchema,
  expected: caseExpectedSchema,
});

export type PricingCase = z.infer<typeof pricingCaseSchema>;
export type PricingCaseInput = z.infer<typeof caseInputSchema>;

export type PricingCaseResult = {
  code: string;
  title: string;
  // "skipped" = a scope "goat" case (THE GOAT's rules only).
  status: "pass" | "fail" | "skipped";
  expectedCost: number | null;
  actualCost: number | null;
  problems: string[];
};

/** The AppConfig a case is priced under: one rate row named "T". */
export function configForCase(input: PricingCaseInput): AppConfig {
  return {
    currency: "AUD",
    gstRate: 0.1,
    minBillableHours: input.settings.minBillableHours,
    dayStart: input.settings.dayStart,
    nightStart: input.settings.nightStart,
    rates: [
      {
        role: CASE_ROLE,
        day: input.rate.day,
        night: input.rate.night,
        sunday: input.rate.sunday,
        publicHoliday: input.rate.publicHoliday,
        over8: input.rate.over8,
        over10: input.rate.over10,
        minBillableHours: input.rate.minBillableHours ?? null,
        setCode: STANDARD_SET_CODE,
        callNames: [],
      },
    ],
    publicHolidays: input.publicHolidays.map((date) => ({ date, label: "" })),
    doublePenaltyWindows: input.doublePenaltyWindows,
    quoteText: { termsAndConditions: "" },
  };
}

const cents = (n: number) => Math.round(n * 100);
const sameToTheCent = (a: number, b: number) => cents(a) === cents(b);

/**
 * Run one case. `raw` is the case as stored (untrusted shape): a case that
 * doesn't match the §7.1 format fails, naming what's wrong. Money and hours
 * compare to the cent.
 */
export function runPricingCase(raw: unknown): PricingCaseResult {
  const code =
    raw && typeof raw === "object" && typeof (raw as any).code === "string"
      ? (raw as any).code
      : "(no code)";

  const parsed = pricingCaseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      code,
      title: "",
      status: "fail",
      expectedCost: null,
      actualCost: null,
      problems: parsed.error.issues.map(
        (i) => `bad case format at ${i.path.join(".") || "(root)"}: ${i.message}`
      ),
    };
  }

  const c = parsed.data;
  const title = c.title ?? "";
  if (c.scope === "goat") {
    return { code, title, status: "skipped", expectedCost: c.expected.costExGst, actualCost: null, problems: [] };
  }

  const r = calculateLabourLine({ role: CASE_ROLE, ...c.input.line, id: c.code }, configForCase(c.input));
  const problems: string[] = [...r.errors];

  if (!sameToTheCent(r.costExGst, c.expected.costExGst)) {
    problems.push(`costExGst ${r.costExGst.toFixed(2)}, expected ${c.expected.costExGst.toFixed(2)}`);
  }
  if (c.expected.billableHours !== undefined && !sameToTheCent(r.billableHours, c.expected.billableHours)) {
    problems.push(`billableHours ${r.billableHours}, expected ${c.expected.billableHours}`);
  }

  const want = c.expected.segments;
  if (want) {
    if (want.length !== r.segments.length) {
      problems.push(`${r.segments.length} segments, expected ${want.length}`);
    } else {
      want.forEach((w, i) => {
        const s = r.segments[i];
        const label = `segment ${i + 1}`;
        if (s.tier !== w.tier || s.period !== w.period || s.dateISO !== w.dateISO) {
          problems.push(`${label} is ${s.dateISO} ${s.tier} ${s.period}, expected ${w.dateISO} ${w.tier} ${w.period}`);
        }
        for (const k of ["hours", "rate", "costExGst"] as const) {
          if (!sameToTheCent(s[k], w[k])) problems.push(`${label} ${k} ${s[k]}, expected ${w[k]}`);
        }
        if (w.doublePenalty !== undefined && Boolean(s.doublePenalty) !== w.doublePenalty) {
          problems.push(`${label} doublePenalty ${Boolean(s.doublePenalty)}, expected ${w.doublePenalty}`);
        }
      });
    }
  }

  return {
    code,
    title,
    status: problems.length ? "fail" : "pass",
    expectedCost: c.expected.costExGst,
    actualCost: r.costExGst,
    problems,
  };
}
