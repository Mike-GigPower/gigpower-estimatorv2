import { calculateQuoteTotals } from "./estimator/calc";
import type { AppConfig, QuoteInput, QuoteResult } from "./types";

// config is required: defaultConfig is a pre-load placeholder below the live
// card, so an implicit default under-quotes silently.
export function estimateQuote(input: QuoteInput, config: AppConfig): QuoteResult {
  return calculateQuoteTotals(input, config);
}
