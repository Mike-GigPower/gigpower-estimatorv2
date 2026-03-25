"use client";

import { useEffect, useState } from "react";
import { defaultConfig } from "./config";
import { loadAppConfig, resetAppConfig, saveAppConfig } from "./config-store";
import type { AppConfig } from "./types";

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConfig(loadAppConfig());
    setReady(true);
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