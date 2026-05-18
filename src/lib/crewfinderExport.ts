import type { AppConfig, QuoteInput } from "./types";

export type CrewFinderPayload = {
  schema_version: "1.0";
  exported_at: string;
  estimate: {
    estimate_id: string;
    quote_number: string;
    version: number;
    status: "Approved";
    created_at: string;
    approved_at: string;
    created_by: string;
    approved_by: string;
  };
  customer: {
    company_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
  };
  event: {
    event_name: string;
    venue_name: string;
    venue_address: string;
    onsite_contact: string;
    event_notes: string;
    access_notes: string;
    operational_notes: string;
  };
  labour_lines: Array<{
    line_id: string;
    crew_type: string;
    call_name?: string;
    quantity: number;
    date: string;
    start_time: string;
    duration_hours: number;
    shift_notes: string | null;
    public_holiday_same_day: boolean;
    public_holiday_next_day: boolean;
  }>;
};

export type CrewFinderExportOptions = {
  estimateId: string;
  version: number;
  createdAt: string;
  approvedAt: string;
  createdBy: string;
  approvedBy: string;
  config: AppConfig;
};

function isPublicHoliday(dateISO: string, config: AppConfig): boolean {
  return config.publicHolidays.some((h) => h.date === dateISO);
}

function nextDayISO(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildCrewFinderPayload(
  input: QuoteInput,
  opts: CrewFinderExportOptions
): CrewFinderPayload {
  return {
    schema_version: "1.0",
    exported_at: new Date().toISOString(),
    estimate: {
      estimate_id: opts.estimateId,
      quote_number: input.quoteNumber,
      version: opts.version,
      status: "Approved",
      created_at: opts.createdAt,
      approved_at: opts.approvedAt,
      created_by: opts.createdBy,
      approved_by: opts.approvedBy,
    },
    customer: {
      company_name: input.companyName,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
    },
    event: {
      event_name: input.eventName || input.companyName || "",
      venue_name: input.venue,
      venue_address: "",
      onsite_contact: input.onsiteContact || "",
      event_notes: "",
      access_notes: "",
      operational_notes: input.notes || "",
    },
    labour_lines: input.labour.map((line, idx) => ({
      line_id: `ll_${String(idx + 1).padStart(3, "0")}`,
      crew_type: line.role,
      ...(line.callName ? { call_name: line.callName } : {}),
      quantity: line.qty,
      date: line.shiftDate,
      start_time: line.startTime,
      duration_hours: line.durationHours,
      shift_notes: line.notes?.trim() || null,
      public_holiday_same_day: isPublicHoliday(line.shiftDate, opts.config),
      public_holiday_next_day: isPublicHoliday(nextDayISO(line.shiftDate), opts.config),
    })),
  };
}

export function downloadCrewFinderJson(
  payload: CrewFinderPayload,
  quoteNumber: string,
  version: number
): void {
  const filename = `GP-${quoteNumber}-v${version}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
