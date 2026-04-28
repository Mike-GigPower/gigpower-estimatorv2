import type { QuoteInput } from "./types";
import { parseDurationHours } from "./calc";

type PublicEstimateRequestBody = {
  customerName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  eventLocation?: string;
  notes?: string;
  crewLines?: {
    id: string;
    crewType: string;
    qty: string;
    shiftDate: string;
    startTime: string;
    duration: string;
    notes?: string;
  }[];
};

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

    labour: (body.crewLines || []).map((line) => ({
      id: line.id,
      role: line.crewType,
      qty: Number(line.qty),
      shiftDate: line.shiftDate,
      startTime: line.startTime,
      durationHours: parseDurationHours(line.duration) ?? 0,
      notes: line.notes,
    })),

    nonLabour: [],
  };
}