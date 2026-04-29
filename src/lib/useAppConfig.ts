"use client";

import { useEffect, useState } from "react";
import { defaultConfig } from "./config";
import { supabaseData } from "./supabase";
import { createClient } from "./supabase/client";
import type { AppConfig } from "./types";

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const baseConfig = defaultConfig;
const authClient = createClient();
const { data: settingsData, error: settingsError } = await authClient
  .from("app_settings")
  .select("value")
  .eq("id", "global")
  .single();
      const { data: holidaysData, error: holidaysError } = await supabaseData
        .from("public_holidays")
        .select("holiday_date, name")
        .eq("is_active", true)
        .order("holiday_date", { ascending: true });

      const { data: ratesData, error: ratesError } = await authClient
  .from("rate_cards")
        .select(
          "role_name, day_rate, night_rate, sunday_rate, public_holiday_rate, ot_8_day_rate, ot_10_day_rate"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (settingsError || holidaysError || ratesError) {
        console.error("Failed to load config from Supabase:", {
          settingsError,
          holidaysError,
          ratesError,
        });

        setConfig(baseConfig);
        setReady(true);
        return;
      }
console.log("Rates loaded from Supabase:", ratesData);
      setConfig({
        ...baseConfig,
        ...(settingsData?.value || {}),
        publicHolidays: (holidaysData || []).map((row: any) => ({
          date: row.holiday_date,
          label: row.name,
        })),
       rates: (ratesData || []).map((row: any) => ({
          role: row.role_name,
          day: row.day_rate,
          night: row.night_rate,
          sunday: row.sunday_rate,
          publicHoliday: row.public_holiday_rate,
          over8: row.ot_8_day_rate,
          over10: row.ot_10_day_rate,
        })),
      });

      setReady(true);
    }

    loadConfig();
  }, []);

 async function updateConfig(next: AppConfig) {
  setConfig(next);

  const authClient = createClient();

  const { error } = await authClient
    .from("app_settings")
    .upsert(
      {
        id: "global",
        value: {
          currency: next.currency,
          gstRate: next.gstRate,
          minBillableHours: next.minBillableHours,
          dayStart: next.dayStart,
          nightStart: next.nightStart,
          quoteText: { termsAndConditions: next.quoteText.termsAndConditions,
  },
        },
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Failed to save app settings:", error);
    alert("Failed to save app settings: " + error.message);
  }
}

  async function restoreDefaults() {
  setConfig(defaultConfig);

  const authClient = createClient();

  const { error } = await authClient
    .from("app_settings")
    .upsert(
      {
        id: "global",
        value: {
          currency: defaultConfig.currency,
          gstRate: defaultConfig.gstRate,
          minBillableHours: defaultConfig.minBillableHours,
          dayStart: defaultConfig.dayStart,
          nightStart: defaultConfig.nightStart,
          quoteText: {
  termsAndConditions: defaultConfig.quoteText.termsAndConditions,
},
        },
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Failed to restore defaults:", error);
    alert("Failed to restore defaults: " + error.message);
  }
}

  return {
    config,
    updateConfig,
    restoreDefaults,
    ready,
  };
}