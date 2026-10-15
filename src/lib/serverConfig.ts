import { supabaseData } from "./supabase";
import { defaultConfig } from "./config";
import { STANDARD_SET_CODE, STANDARD_SET_ID, type AppConfig } from "./types";
import {
  DOUBLE_PENALTY_WINDOW_COLUMNS,
  RATE_CARD_COLUMNS,
  mapDoublePenaltyWindowRow,
  mapRateCardRow,
} from "./rateCards";

/**
 * Server-side equivalent of useAppConfig's load path, for API routes that
 * price a quote outside the browser.
 *
 * Deliberately returns null rather than falling back to defaultConfig: the
 * defaults are a pre-load placeholder and are 4.6-14.5% below the live rate
 * card, so pricing against them under-quotes silently. A caller that cannot
 * get a config must decline to produce a total, not produce a wrong one.
 *
 * The column list and field mapping are shared with useAppConfig.ts
 * (rateCards.ts) so the server and the Estimator agree on price.
 *
 * Standard card only. This runs with the anon key, which can't read
 * rate_card_sets (so no join for the set code) and is limited to Standard
 * rows by RLS. The explicit set_id filter keeps customer rates out of public
 * pricing even if that policy changes.
 */
export async function loadAppConfigServer(): Promise<AppConfig | null> {
  const [settingsRes, holidaysRes, windowsRes, ratesRes] = await Promise.all([
    supabaseData
      .from("app_settings")
      .select("value")
      .eq("id", "global")
      .single(),
    supabaseData
      .from("public_holidays")
      .select("holiday_date, name")
      .eq("is_active", true)
      .order("holiday_date", { ascending: true }),
    supabaseData
      .from("double_penalty_windows")
      .select(DOUBLE_PENALTY_WINDOW_COLUMNS)
      .eq("is_active", true),
    supabaseData
      .from("rate_cards")
      .select(RATE_CARD_COLUMNS)
      .eq("is_active", true)
      .eq("set_id", STANDARD_SET_ID)
      .order("sort_order", { ascending: true }),
  ]);

  if (settingsRes.error || holidaysRes.error || windowsRes.error || ratesRes.error) {
    console.error("loadAppConfigServer: Supabase read failed", {
      settingsError: settingsRes.error,
      holidaysError: holidaysRes.error,
      windowsError: windowsRes.error,
      ratesError: ratesRes.error,
    });
    return null;
  }

  // An empty rate card is indistinguishable from a misconfigured read, and
  // either way nothing can be priced. Fail rather than return a config whose
  // rates array is empty (every line would resolve to "Role is invalid").
  if (!ratesRes.data || ratesRes.data.length === 0) {
    console.error("loadAppConfigServer: no active rate cards returned");
    return null;
  }

  return {
    ...defaultConfig,
    ...((settingsRes.data?.value as Partial<AppConfig>) || {}),
    publicHolidays: (holidaysRes.data || []).map((row: any) => ({
      date: row.holiday_date,
      label: row.name,
    })),
    doublePenaltyWindows: (windowsRes.data || []).map(mapDoublePenaltyWindowRow),
    rates: ratesRes.data.map((row: any) => mapRateCardRow(row, STANDARD_SET_CODE)),
  };
}