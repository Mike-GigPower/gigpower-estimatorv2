import {
  CUSTOMER_CARD_CALL_NAMES,
  MOPT_AO_SET_CODE,
  MOPT_SET_CODE,
  STANDARD_SET_CODE,
  type AppConfig,
  type CrewFinderCallName,
  type QuoteRateCard,
  type RateRow,
} from "./types";

/**
 * rate_cards columns every loader reads. The set code is added per loader:
 * signed-in loaders embed rate_card_sets(code); the anon server loader can't
 * read rate_card_sets and filters to Standard instead.
 */
export const RATE_CARD_COLUMNS =
  "role_name, day_rate, night_rate, sunday_rate, public_holiday_rate, ot_8_day_rate, ot_10_day_rate, effective_from, sort_order, set_id, call_names";

// A null rate means "no tier". Number(null) is 0, which would turn "no tier"
// into a $0 tier, so null must be kept as null.
function rateOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Map one rate_cards row (RATE_CARD_COLUMNS) to a RateRow. */
export function mapRateCardRow(row: any, setCode: string): RateRow {
  return {
    role: row.role_name,
    day: Number(row.day_rate),
    night: Number(row.night_rate),
    sunday: Number(row.sunday_rate),
    publicHoliday: Number(row.public_holiday_rate),
    over8: rateOrNull(row.ot_8_day_rate),
    over10: rateOrNull(row.ot_10_day_rate),
    effectiveFrom: row.effective_from,
    sortOrder: row.sort_order,
    setCode,
    callNames: Array.isArray(row.call_names) ? row.call_names : [],
  };
}

/**
 * The set code a quote's booking answers select, or null when the quote
 * can't be priced yet (MOPT ticked, Australian Open unanswered).
 */
export function rateCardSetCode(rateCard?: QuoteRateCard | null): string | null {
  if (!rateCard?.mopt) return STANDARD_SET_CODE;
  if (rateCard.australianOpen === true) return MOPT_AO_SET_CODE;
  if (rateCard.australianOpen === false) return MOPT_SET_CODE;
  return null;
}

/**
 * The rates a quote is priced from: Standard plus the quote's customer card,
 * if any. Role names are unique across cards, so the engine can look rates up
 * by role in the combined list. Returns null when the quote isn't priceable.
 */
export function ratesForQuote(
  config: AppConfig,
  rateCard?: QuoteRateCard | null
): RateRow[] | null {
  const code = rateCardSetCode(rateCard);
  if (code === null) return null;
  return config.rates.filter(
    (r) => r.setCode === STANDARD_SET_CODE || r.setCode === code
  );
}

/**
 * Whether a call name can be used under the given card rates. Ordinary call
 * names always can (a card that doesn't list them prices them from Standard).
 * Customer-card call names (Training, Field of Play) only when a row on the
 * quote's card lists them.
 */
export function isCallNameOnCard(
  callName: string,
  cardRates: readonly RateRow[]
): boolean {
  if (!CUSTOMER_CARD_CALL_NAMES.includes(callName as CrewFinderCallName)) return true;
  return cardRates.some(
    (r) => r.setCode !== STANDARD_SET_CODE && r.callNames.includes(callName)
  );
}

/** The per-line message for a call name the quote's card doesn't offer. */
export function callNameNotOnCardMessage(callName: string): string {
  return `${callName} isn't on this card.`;
}

/**
 * Human label for a non-Standard card, for the printed quote and PDF.
 * Null for Standard. Wording pending Q-A.
 */
export function rateCardLabel(rateCard?: QuoteRateCard | null): string | null {
  const code = rateCardSetCode(rateCard);
  if (code === MOPT_SET_CODE) return "MOPT — Year Round";
  if (code === MOPT_AO_SET_CODE) return "MOPT — Australian Open";
  return null;
}
