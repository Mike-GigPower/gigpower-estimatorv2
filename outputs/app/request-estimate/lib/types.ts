/**
 * Types local to the public request-estimate route.
 *
 * NOTE: the field name `crewType` is preserved here for backwards
 * compatibility with the existing API payload and DB schema. It actually
 * holds a SmartStaff Call Name (e.g. "Load In"). A planned future phase
 * will rename this to `callName` end-to-end before go-live.
 */

export type PublicCrewLine = {
  id: string;
  crewType: string;       // SmartStaff Call Name — see note above
  qty: string;
  shiftDate: string;
  startTime: string;
  duration: string;
  notes: string;
};

export type PublicEstimateRequest = {
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  crewLines: PublicCrewLine[];
  notes: string;
  needsCrewAdvice: boolean;
};

export type Step = "form" | "verify" | "submitted";

export type FieldErrors = Record<string, string>;
