import { defaultConfig } from "./config";
import { appConfigSchema } from "./schema";
import type { AppConfig } from "./types";

const STORAGE_KEY = "gigpower_app_config_v1";

export function loadAppConfig(): AppConfig {
  if (typeof window === "undefined") return defaultConfig;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig;

    const parsed = JSON.parse(raw);
    const validated = appConfigSchema.safeParse(parsed);

    if (!validated.success) return defaultConfig;

    return validated.data;
  } catch {
    return defaultConfig;
  }
}

export function saveAppConfig(config: AppConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetAppConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}