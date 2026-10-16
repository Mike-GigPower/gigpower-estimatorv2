// rate-cards: THE GOAT's single read of every pricing rule (C1, D32), also
// used by the Estimator's release check (scripts/pricing-tests.ts).
// BRIEF-estimator-pricing-rules-stage0 §8.
//
//   GET /functions/v1/rate-cards     Header: X-GOAT-Secret: <secret>
//
// Deploy with --no-verify-jwt EVERY time: callers send the shared secret,
// not a Supabase JWT, so the gateway's JWT check would reject them.
// Reads with the service role (auto-provided env), because anon can't see
// rate_card_sets, customer rate rows or the test cases.
import { createClient } from "npm:@supabase/supabase-js@2.104.0";

import { handleRequest, type RulesData } from "./rules.ts";

// Every table the response is built from; last_changed is the latest
// updated_at across all of them.
const RULE_TABLES = [
  "app_settings",
  "public_holidays",
  "double_penalty_windows",
  "rate_card_sets",
  "rate_cards",
  "rate_items",
  "pricing_test_cases",
];

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

async function load(): Promise<RulesData> {
  const [settings, holidays, windows, sets, rates, items, testCases] = await Promise.all([
    db.from("app_settings").select("value").eq("id", "global").single(),
    db.from("public_holidays").select("holiday_date, name").eq("is_active", true),
    db
      .from("double_penalty_windows")
      .select("name, start_md, start_time, end_md, end_time, multiplier")
      .eq("is_active", true),
    db
      .from("rate_card_sets")
      .select("id, code, name, kind, smartstaff_customer_ids, sort_order")
      .eq("is_active", true),
    db.from("rate_cards").select("*").eq("is_active", true),
    db.from("rate_items").select("*").eq("is_active", true),
    db
      .from("pricing_test_cases")
      .select("code, title, rule, scope, input, expected")
      .eq("is_active", true),
  ]);

  // Inactive rows included, so deactivating a row also moves last_changed.
  const latest = await Promise.all(
    RULE_TABLES.map((t) =>
      db.from(t).select("updated_at").order("updated_at", { ascending: false }).limit(1)
    )
  );

  const failed = [settings, holidays, windows, sets, rates, items, testCases, ...latest].find(
    (r) => r.error
  );
  if (failed?.error) throw failed.error;

  const stamps = latest
    .map((r) => (r.data?.[0] as { updated_at?: string } | undefined)?.updated_at)
    .filter((t): t is string => typeof t === "string");
  const lastChanged = stamps.length
    ? new Date(Math.max(...stamps.map((t) => Date.parse(t)))).toISOString()
    : null;

  return {
    settings: (settings.data?.value as Record<string, unknown>) ?? null,
    holidays: holidays.data ?? [],
    windows: windows.data ?? [],
    sets: sets.data ?? [],
    rates: rates.data ?? [],
    items: items.data ?? [],
    testCases: testCases.data ?? [],
    lastChanged,
  };
}

Deno.serve((req) => handleRequest(req, { secret: Deno.env.get("RATE_CARDS_SECRET"), load }));
