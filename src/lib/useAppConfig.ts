"use client";

import { useEffect, useState } from "react";
import { defaultConfig } from "./config";
import { supabaseData } from "./supabase";
import { createClient } from "./supabase/client";
import type { AppConfig } from "./types";
import {
  DOUBLE_PENALTY_WINDOW_COLUMNS,
  RATE_CARD_COLUMNS,
  mapDoublePenaltyWindowRow,
  mapRateCardRow,
} from "./rateCards";
 
/**
 * Read the stored settings so a save keeps any key this screen doesn't manage.
 * Returns null if the read fails: the caller must then not save, or it would
 * wipe those keys.
 */
async function readStoredSettings(
  client: ReturnType<typeof createClient>
): Promise<Record<string, any> | null> {
  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("id", "global")
    .maybeSingle();
  if (error) return null;
  return (data?.value as Record<string, any>) ?? {};
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [ready, setReady] = useState(false);
  // Set when the live config can't be loaded. ready then stays false: there is
  // deliberately no fallback to defaultConfig, which is the pre-July card and
  // 4.6-14.5% below live rates. Callers must block pricing and say why.
  const [loadError, setLoadError] = useState<string | null>(null);

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
      // Active only (explicit, like holidays; anon RLS also filters).
      const { data: windowsData, error: windowsError } = await supabaseData
        .from("double_penalty_windows")
        .select(DOUBLE_PENALTY_WINDOW_COLUMNS)
        .eq("is_active", true);

      // All active card sets (Standard + customer), so a quote can switch card
      // without reloading. The embedded set supplies each row's set code.
      const { data: ratesData, error: ratesError } = await authClient
        .from("rate_cards")
        .select(`${RATE_CARD_COLUMNS}, rate_card_sets!inner(code, is_active)`)
        .eq("is_active", true)
        .eq("rate_card_sets.is_active", true)
        .order("sort_order", { ascending: true });

      if (settingsError || holidaysError || windowsError || ratesError || !ratesData?.length) {
        console.error("Failed to load config from Supabase:", {
          settingsError,
          holidaysError,
          windowsError,
          ratesError,
          rateRows: ratesData?.length ?? 0,
        });

        setLoadError("Rates couldn't be loaded. Refresh before pricing.");
        return;
      }

      setConfig({
        ...baseConfig,
        ...(settingsData?.value || {}),
        publicHolidays: (holidaysData || []).map((row: any) => ({
          date: row.holiday_date,
          label: row.name,
        })),
        doublePenaltyWindows: (windowsData || []).map(mapDoublePenaltyWindowRow),
        rates: ratesData.map((row: any) => mapRateCardRow(row, row.rate_card_sets.code)),
      });

      setReady(true);
    }

    loadConfig();
  }, []);

 async function updateConfig(next: AppConfig) {
  setConfig(next);

  const authClient = createClient();
  
  const stored = await readStoredSettings(authClient);
  if (!stored) {
    alert("Couldn't read the current settings, so nothing was saved. Refresh and try again.");
    return;
  }

    const { error } = await authClient
    .from("app_settings")
    .upsert(
      {
        id: "global",
        value: {
          ...stored,
          currency: next.currency,
          gstRate: next.gstRate,
          minBillableHours: next.minBillableHours,
          dayStart: next.dayStart,
          nightStart: next.nightStart,
          quoteText: {
            ...(stored.quoteText || {}),
            termsAndConditions: next.quoteText.termsAndConditions,
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
  // Restores the settings only. Rates and holidays live in their own tables;
  // swapping in defaultConfig's would show the stale pre-July card.
  setConfig((prev) => ({
    ...defaultConfig,
    rates: prev.rates,
    publicHolidays: prev.publicHolidays,
  }));

  const authClient = createClient();
  const stored = await readStoredSettings(authClient);
  if (!stored) {
    alert("Couldn't read the current settings, so nothing was restored. Refresh and try again.");
    return;
  }


    const { error } = await authClient
    .from("app_settings")
    .upsert(
      {
        id: "global",
        value: {
          ...stored,
          currency: defaultConfig.currency,
          gstRate: defaultConfig.gstRate,
          minBillableHours: defaultConfig.minBillableHours,
          dayStart: defaultConfig.dayStart,
          nightStart: defaultConfig.nightStart,
          quoteText: {
            ...(stored.quoteText || {}),
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
    loadError,
  };
}