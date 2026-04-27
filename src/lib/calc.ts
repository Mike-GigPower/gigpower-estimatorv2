import { defaultConfig } from "./config";
import { calculateQuoteTotals } from "./estimator/calc";
import type { AppConfig, QuoteInput, QuoteResult } from "./types";

export function estimateQuote(input: QuoteInput, config: AppConfig = defaultConfig): QuoteResult {
  return calculateQuoteTotals(input, config);
}
