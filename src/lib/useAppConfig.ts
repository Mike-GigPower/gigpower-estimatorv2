"use client";

import { useEffect, useState } from "react";
import { defaultConfig } from "./config";
import { loadAppConfig, resetAppConfig, saveAppConfig } from "./config-store";
import { supabaseData } from "./supabase";
import { createClient } from "./supabase/client";
import type { AppConfig } from "./types";

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const localConfig = loadAppConfig();
const authClient = createClient();
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

      if (holidaysError || ratesError) {
        console.error("Failed to load config from Supabase:", {
          holidaysError,
          ratesError,
        });

        setConfig(localConfig);
        setReady(true);
        return;
      }
console.log("Rates loaded from Supabase:", ratesData);
      setConfig({
        ...localConfig,
        publicHolidays: (holidaysData || []).map((row) => ({
          date: row.holiday_date,
          label: row.name,
        })),
        rates: (ratesData || []).map((row) => ({
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

  function updateConfig(next: AppConfig) {
    setConfig(next);
    saveAppConfig(next);
  }

  function restoreDefaults() {
    resetAppConfig();
    setConfig(defaultConfig);
  }

  return {
    config,
    updateConfig,
    restoreDefaults,
    ready,
  };
}