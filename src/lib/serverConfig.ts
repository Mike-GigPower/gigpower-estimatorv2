import { supabaseData } from "./supabase";
import { defaultConfig } from "./config";
import type { AppConfig } from "./types";

/**
 * Server-side equivalent of useAppConfig's load path, for API routes that
 * price a quote outside the browser.
 *
 * Deliberately returns null rather than falling back to defaultConfig: the
 * defaults are a pre-load placeholder and are 4.6-14.5% below the live rate
 * card, so pricing against them under-quotes silently. A caller that cannot
 * get a config must decline to produce a total, not produce a wrong one.
 *
 * The column list and field mapping mirror useAppConfig.ts exactly so the
 * server and the Estimator agree on price. Keep them in sync.
 */
export async function loadAppConfigServer(): Promise<AppConfig | null> {
  const [settingsRes, holidaysRes, ratesRes] = await Promise.all([
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
      .from("rate_cards")
      .select(
        "role_name, day_rate, night_rate, sunday_rate, public_holiday_rate, ot_8_day_rate, ot_10_day_rate, effective_from, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (settingsRes.error || holidaysRes.error || ratesRes.error) {
    console.error("loadAppConfigServer: Supabase read failed", {
      settingsError: settingsRes.error,
      holidaysError: holidaysRes.error,
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
    rates: ratesRes.data.map((row: any) => ({
      role: row.role_name,
      day: Number(row.day_rate),
      night: Number(row.night_rate),
      sunday: Number(row.sunday_rate),
      publicHoliday: Number(row.public_holiday_rate),
      over8: Number(row.ot_8_day_rate),
      over10: Number(row.ot_10_day_rate),
      effectiveFrom: row.effective_from,
      sortOrder: row.sort_order,
    })),
  };
}