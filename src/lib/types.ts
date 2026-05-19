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
  "Wardrobe": "Seamstress",
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
 * Call Names visible in the internal Estimator UI.
 * "Other" is not selectable; "Crown Hand" remains available to admins.
 */
export const ESTIMATOR_UI_CALL_NAMES: CrewFinderCallName[] =
  CREWFINDER_CALL_NAMES.filter((name) => name !== "Other") as CrewFinderCallName[];

/**
 * Resolve a Call Name to its mapped rate role.
 * Returns "Standard Crew" as a safe fallback when the call name is unknown
 * or empty.
 */
export function roleForCallName(callName: string | undefined | null): string {
  if (!callName) return "Standard Crew";
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
  callName?: CrewFinderCallName | "";
  publicHolidaySameDay?: boolean;
  publicHolidayNextDay?: boolean;
};

export type NonLabourLine = {
  id: string;
  description: string;
  qty: number;
  amountExGst: number;
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
  onsiteContact?: string;
  labour: LabourLine[];
  nonLabour: NonLabourLine[];
  status?: "Draft" | "Sent" | "Approved" | "Exported to Operations";
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
};

export type NonLabourLineResult = {
  id: string;
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

export type RateRow = {
  role: string;
  day: number;
  night: number;
  sunday: number;
  publicHoliday: number;
  over8: number;
  over10: number;
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
  quoteText: {
    termsAndConditions: string;
  };
};
