import type { QuoteInput } from "./types";
import { parseDurationHours, parseStartTime } from "./calc";
import {
  roleForCallName,
  type CrewFinderCallName,
  CREWFINDER_CALL_NAMES,
} from "../types";

type PublicEstimateRequestBody = {
  customerName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  eventLocation?: string;
  notes?: string;
  crewLines?: {
    id: string;
    /**
     * Now carries the SmartStaff Call Name selected on the public Request UI
     * (e.g. "Load In"). The field name is preserved as `crewType` to keep the
     * API payload shape stable.
     */
    crewType: string;
    qty: string;
    shiftDate: string;
    startTime: string;
    duration: string;
    notes?: string;
  }[];
};

const VALID_CALL_NAMES = new Set<string>(CREWFINDER_CALL_NAMES);

function toCallName(value: string | undefined): CrewFinderCallName | "" {
  if (value && VALID_CALL_NAMES.has(value)) return value as CrewFinderCallName;
  return "";
}

export function publicRequestToQuoteInput(
  body: PublicEstimateRequestBody
): QuoteInput {
  return {
    quoteNumber: "",
    quoteDate: "",
    validUntil: "",

    companyName: body.companyName || "",
    contactName: body.customerName || "",
    contactEmail: body.email || "",
    contactPhone: body.phone || "",
    venue: body.eventLocation || "",
    notes: body.notes || "",

    labour: (body.crewLines || []).map((line) => {
      const callName = toCallName(line.crewType);
      return {
        id: line.id,
        // Role is derived from the Call Name; users no longer select it directly.
        role: roleForCallName(callName || line.crewType),
        callName,
        qty: Number(line.qty),
        shiftDate: line.shiftDate,
        // Normalise here, not just in the UI. The public form only normalises
        // on blur, and its validate() accepts any non-empty start time, so a
        // submit that skips the blur (Enter key in the field) or a direct POST
        // can deliver "8". Left raw, parseTimeHHMM reads that as 00:00 and
        // prices a full shift at night rates. Unparseable values are passed
        // through unchanged so the engine still rejects them loudly.
        startTime: parseStartTime(line.startTime) ?? line.startTime,
        durationHours: parseDurationHours(line.duration) ?? 0,
        notes: line.notes,
      };
    }),

    nonLabour: [],
  };
}
