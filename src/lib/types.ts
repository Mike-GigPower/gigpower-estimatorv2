export const CREWFINDER_CALL_NAMES = [
  "Load In",
  "Load Out",
  "LX",
  "SX",
  "VX",
  "Backline",
  "Show Call",
  "FOH Spot",
  "Truss Spot",
  "Wardrobe",
  "Seamstress",
  "Steel",
  "Fork",
  "Truck",
  "EWP",
  "Crown Hand",
  "Crew Boss",
  "Site",
  "Utility",
  "General",
  "Other",
] as const;

export type CrewFinderCallName = (typeof CREWFINDER_CALL_NAMES)[number];

/**
 * Maps each SmartStaff/CrewFinder Call Name to the rate-card role that
 * drives pricing for that call.
 *
 * The role field on a LabourLine is no longer user-editable in the Request
 * or Estimator UI — it is derived from the chosen Call Name via this map.
 *
 * "Other" is intentionally mapped to "Standard Crew" as a safe default; the
 * Call Name "Other" is hidden in both the Request and Estimator UIs and can
 * only appear on legacy data.
 */
export const CALL_NAME_TO_ROLE: Record<CrewFinderCallName, string> = {
  "Load In": "Standard Crew",
  "Load Out": "Standard Crew",
  "LX": "Standard Crew",
  "SX": "Standard Crew",
  "VX": "Standard Crew",
  "Backline": "Standard Crew",
  "Show Call": "Show Crew",
  "FOH Spot": "Show Crew",
  "Truss Spot": "Show Crew",
  "Wardrobe": "Show Crew",
  "Seamstress": "Seamstress",
  "Steel": "Steel Hand",
  "Fork": "Fork/Truck/EWP",
  "Truck": "Fork/Truck/EWP",
  "EWP": "Fork/Truck/EWP",
  "Crown Hand": "Crown Hand",
  "Crew Boss": "Crew Boss",
  "Site": "Standard Crew",
  "Utility": "Standard Crew",
  "General": "Standard Crew",
  "Other": "Standard Crew",
};

/**
 * Call Names visible in the public Request UI.
 * "Crown Hand" and "Other" are not selectable by customers.
 */
export const REQUEST_UI_CALL_NAMES: CrewFinderCallName[] =
  CREWFINDER_CALL_NAMES.filter(
    (name) => name !== "Crown Hand" && name !== "Other"
  ) as CrewFinderCallName[];

/**
 * Standard Call Names visible in the internal Estimator UI.
 * "Other" is not selectable; "Crown Hand" remains available to admins.
 * A quote on a customer card offers that card's role names instead (see
 * cardCallNames).
 */
export const ESTIMATOR_UI_CALL_NAMES: CrewFinderCallName[] =
  CREWFINDER_CALL_NAMES.filter((name) => name !== "Other") as CrewFinderCallName[];

/**
 * Resolve a Call Name to its mapped rate role.
 *
 * With `cardRates` (the rates a quote is priced from, see ratesForQuote), a
 * customer-card row whose call_names lists the call name wins. A customer
 * row's call_names holds its own role name, so on a customer card the call
 * name is the role. Otherwise the standard CALL_NAME_TO_ROLE map applies.
 *
 * Returns "Standard Crew" as a safe fallback when the call name is unknown
 * or empty.
 */
export function roleForCallName(
  callName: string | undefined | null,
  cardRates?: readonly RateRow[] | null
): string {
  if (!callName) return "Standard Crew";
  if (cardRates) {
    const cardRow = cardRates.find(
      (r) => r.setCode !== STANDARD_SET_CODE && r.callNames.includes(callName)
    );
    if (cardRow) return cardRow.role;
  }
  const mapped = (CALL_NAME_TO_ROLE as Record<string, string>)[callName];
  return mapped || "Standard Crew";
}

export type LabourLine = {
  id: string;
  role: string;
  qty: number;
  shiftDate: string;
  startTime: string;
  durationHours: number;
  notes?: string;
  // A standard CrewFinderCallName, or on a customer card that card's role name.
  callName?: string;
  publicHolidaySameDay?: boolean;
  publicHolidayNextDay?: boolean;
};

export type LabourCostSegment = {
  tier: "base" | "ot8" | "ot10";
  period: "day" | "night";
  dateISO: string;
  hours: number;
  rate: number;
  costExGst: number;
  // Set only on a slice inside a D31 window ("Christmas", 2).
  doublePenalty?: boolean;
  windowName?: string;
  multiplier?: number;
};

export type NonLabourLine = {
  id: string;
  title: string;
  description: string;
  qty: number;
  amountExGst: number;
};

/**
 * The booking questions that choose a quote's rate card. Absent means the
 * Standard card, which is how every quote before rate-card sets was priced.
 * australianOpen is null until answered, and always null when mopt is false.
 */
export type QuoteRateCard = {
  mopt: boolean;
  australianOpen: boolean | null;
};

export type QuoteInput = {
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  sourceRequestId?: string;
  requestNumber?: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  venue: string;
  notes: string;
  eventName?: string;
  eventDate?: string;
  onsiteContact?: string;
  onsiteContactPhone?: string;
  labour: LabourLine[];
  nonLabour: NonLabourLine[];
  rateCard?: QuoteRateCard;
  status?: "Draft" | "Sent" | "Approved" | "Declined" | "Exported to Operations";
};

export type LabourLineResult = {
  id: string;
  role: string;
  qty: number;
  shiftDate: string;
  startTime: string;
  durationHours: number;
  billableHours: number;
  costExGst: number;
  gst: number;
  totalIncGst: number;
  breakdown: {
    baseDayHrs: number;
    baseNightHrs: number;
    ot8DayHrs: number;
    ot8NightHrs: number;
    ot10DayHrs: number;
    ot10NightHrs: number;
  };
  segments?: LabourCostSegment[];
};

export type NonLabourLineResult = {
  id: string;
  title: string;
  description: string;
  qty: number;
  unitAmountExGst: number;
  lineAmountExGst: number;
  gst: number;
  totalIncGst: number;
};

export type QuoteResult = {
  isValid: boolean;
  validationErrors: string[];
  labourLines: LabourLineResult[];
  nonLabourLines: NonLabourLineResult[];
  totals: {
    labourExGst: number;
    nonLabourExGst: number;
    subTotalExGst: number;
    gst: number;
    grandTotalIncGst: number;
  };
};

// The far-past date every existing rate is backfilled to. A rate with this
// effective_from is treated as "always in effect" until a newer version exists.
// MUST match the sentinel in the rate_cards_effective_from.sql migration.
export const RATE_EFFECTIVE_FROM_SENTINEL = "2000-01-01";

// Rate card sets (rate_card_sets). Standard has a fixed id so it can be a
// column default and a literal filter. MUST match Migration A.
export const STANDARD_SET_ID = "00000000-0000-0000-0000-000000000001";
export const STANDARD_SET_CODE = "standard";
export const MOPT_SET_CODE = "mopt";
export const MOPT_AO_SET_CODE = "mopt-ao";

export type RateRow = {
  role: string;
  day: number;
  night: number;
  sunday: number;
  publicHoliday: number;
  // null = the card has no such overtime tier (never a copy of the base rate).
  over8: number | null;
  over10: number | null;
  // Code of the rate_card_sets row this rate belongs to ("standard", "mopt"…).
  setCode: string;
  // Call names this row prices on a customer card. Empty on Standard rows,
  // which use CALL_NAME_TO_ROLE instead.
  callNames: string[];
  // "With effect from" date (YYYY-MM-DD). Optional so in-memory rows built in
  // the admin UI still type-check; rows loaded from Supabase always carry it.
  effectiveFrom?: string;
   // Display/order key for the role, carried through from rate_cards.sort_order.
  sortOrder?: number;
  // Per-role minimum billable hours (S-3). null/absent = the global
  // AppConfig.minBillableHours. Never 0.
  minBillableHours?: number | null;
};

/**
 * A recurring double-penalty window (D31), from double_penalty_windows.
 * Month-day + wall-clock time in Melbourne. An endMd before startMd ends in
 * the next year (New Year: 12-31 20:00 → 01-01 12:00).
 */
export type DoublePenaltyWindow = {
  name: string;
  startMd: string; // "MM-DD"
  startTime: string; // "HH:MM"
  endMd: string;
  endTime: string;
  multiplier: number;
};

export type AppConfig = {
  currency: string;
  gstRate: number;
  minBillableHours: number;
  dayStart: string;
  nightStart: string;
  rates: RateRow[];
  publicHolidays: {
  	date: string;
  	label: string;
  }[];
  // Active windows only. Empty means no window pricing (never invented).
  doublePenaltyWindows: DoublePenaltyWindow[];
  quoteText: {
    termsAndConditions: string;
  };
};