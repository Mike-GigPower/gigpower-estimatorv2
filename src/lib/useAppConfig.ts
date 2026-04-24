"use client";

import { useEffect, useState } from "react";
import { defaultConfig } from "./config";
import { loadAppConfig, resetAppConfig, saveAppConfig } from "./config-store";
import { supabaseData } from "./supabase";
import type { AppConfig } from "./types";

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const localConfig = loadAppConfig();

      const { data, error } = await supabaseData
        .from("public_holidays")
        .select("holiday_date, name")
        .eq("is_active", true)
        .order("holiday_date", { ascending: true });

      if (error) {
        console.error("Failed to load public holidays from Supabase:", error);
        setConfig(localConfig);
        setReady(true);
        return;
      }

      setConfig({
        ...localConfig,
        publicHolidays: (data || []).map((row) => ({
          date: row.holiday_date,
          label: row.name,
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