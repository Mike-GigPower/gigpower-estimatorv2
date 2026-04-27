export type LabourLine = {
  id: string;
  role: string;
  qty: number;
  shiftDate: string;
  startTime: string;
  durationHours: number;
  notes?: string;
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
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  venue: string;
  notes: string;
  labour: LabourLine[];
  nonLabour: NonLabourLine[];
  status?: "Draft" | "Sent" | "Approved";
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

export type RateCategory = "standard" | "fixed";

export type RateRow = {
  role: string;
  category?: RateCategory;
  day: number;
  night: number;
  sunday: number;
  publicHoliday: number;
  over8: number;
  over10: number;
};

export type PublicHoliday = {
  date: string;
  label: string;
};

export type AppConfig = {
  currency: string;
  gstRate: number;
  minBillableHours: number;
  dayStart: string;
  nightStart: string;
  rates: RateRow[];
  publicHolidays: PublicHoliday[];
  quoteText: {
    termsAndConditions: string;
  };
};