// The rate-cards response (BRIEF-estimator-pricing-rules-stage0 §8): every
// pricing rule THE GOAT reads (D32), plus the shared test cases (D33).
//
// Plain TypeScript with no Deno or Supabase imports, so the request handling
// and response shape are unit-tested under Node (rules.test.ts). index.ts
// wires this to Deno.serve and the database.

export const SCHEMA = "rules-1";

type Row = Record<string, unknown>;

/** Everything the response is built from. Rows are active rows only. */
export type RulesData = {
  settings: Row | null; // app_settings.value for id "global"
  holidays: Row[];
  windows: Row[];
  sets: Row[];
  rates: Row[];
  items: Row[];
  testCases: Row[];
  // Latest updated_at across all seven tables, inactive rows included, so a
  // deactivation also counts as a change.
  lastChanged: string | null;
};

// Numeric columns. PostgREST may send numeric as a string; the response
// sends numbers, and null stays null (never 0).
const RATE_NUMERIC = [
  "day_rate",
  "night_rate",
  "sunday_rate",
  "public_holiday_rate",
  "ot_8_day_rate",
  "ot_8_night_rate",
  "ot_10_day_rate",
  "ot_10_night_rate",
  "min_billable_hours",
];
const ITEM_NUMERIC = ["charge_ex_gst"];

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function withNumbers(row: Row, columns: string[]): Row {
  const out: Row = { ...row };
  for (const c of columns) if (c in out) out[c] = numOrNull(out[c]);
  return out;
}

function bySortOrder(a: Row, b: Row): number {
  return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
}

/** The §8 response body. `now` is passed in so tests are deterministic. */
export function buildRules(d: RulesData, now: Date) {
  const s = d.settings ?? {};
  const sets = [...d.sets].sort(bySortOrder).map((set) => ({
    code: set.code,
    name: set.name,
    kind: set.kind,
    smartstaff_customer_ids: Array.isArray(set.smartstaff_customer_ids)
      ? set.smartstaff_customer_ids.map(Number)
      : [],
    // Every active effective_from version; the caller picks by date.
    rates: d.rates
      .filter((r) => r.set_id === set.id)
      .sort(
        (a, b) =>
          bySortOrder(a, b) ||
          String(a.role_name).localeCompare(String(b.role_name)) ||
          String(a.effective_from).localeCompare(String(b.effective_from))
      )
      .map((r): Row => ({
        ...withNumbers(r, RATE_NUMERIC),
        call_names: Array.isArray(r.call_names) ? r.call_names : [],
      })),
    items: d.items
      .filter((i) => i.set_id === set.id)
      .sort(bySortOrder)
      .map((i) => withNumbers(i, ITEM_NUMERIC)),
  }));

  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    last_changed: d.lastChanged,
    settings: {
      dayStart: s.dayStart ?? null,
      nightStart: s.nightStart ?? null,
      minBillableHours: numOrNull(s.minBillableHours),
      gstRate: numOrNull(s.gstRate),
    },
    public_holidays: [...d.holidays]
      .sort((a, b) => String(a.holiday_date).localeCompare(String(b.holiday_date)))
      .map((h) => ({ date: h.holiday_date, name: h.name })),
    double_penalty_windows: d.windows.map((w) => ({
      name: w.name,
      startMd: w.start_md,
      startTime: w.start_time,
      endMd: w.end_md,
      endTime: w.end_time,
      multiplier: numOrNull(w.multiplier),
    })),
    sets,
    test_cases: [...d.testCases]
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
      .map((c) => ({
        code: c.code,
        title: c.title,
        rule: c.rule,
        scope: c.scope,
        input: c.input,
        expected: c.expected,
      })),
  };
}

/**
 * Compare the given secret with the expected one in constant time: both are
 * hashed to 32 bytes first, so neither the content nor the length leaks
 * through timing.
 */
export async function secretsMatch(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

/**
 * GET only, with X-GOAT-Secret. An unset RATE_CARDS_SECRET refuses every
 * request (never "no secret = open"). Errors say nothing about the data.
 */
export async function handleRequest(
  req: Request,
  deps: { secret: string | undefined; load: () => Promise<RulesData>; now?: () => Date }
): Promise<Response> {
  if (req.method !== "GET") return json(405, { error: "GET only" }, { Allow: "GET" });

  if (!deps.secret) {
    console.error("rate-cards: RATE_CARDS_SECRET is not set");
    return json(500, { error: "not configured" });
  }
  const given = req.headers.get("x-goat-secret") ?? "";
  if (!(await secretsMatch(given, deps.secret))) return json(401, { error: "unauthorized" });

  try {
    const data = await deps.load();
    return json(200, buildRules(data, (deps.now ?? (() => new Date()))()));
  } catch (err) {
    console.error("rate-cards: read failed", err);
    return json(500, { error: "couldn't read the rules" });
  }
}
