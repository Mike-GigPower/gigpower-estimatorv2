import type { AppConfig, LabourLine, QuoteInput } from "./types";

export function ddmmyyyyToIso(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function formatDateDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function addDaysToDDMMYYYY(value: string, days: number): string {
  const iso = ddmmyyyyToIso(value);
  const d = iso ? new Date(iso) : new Date();

  d.setDate(d.getDate() + days);
  return formatDateDDMMYYYY(d);
}

export function normaliseHHMM(value: string): string | null {
  const raw = value.trim();
  const m = raw.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function hoursToHHMM(hours: number): string {
  if (!Number.isFinite(hours)) return "00:00";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function autoColonHHMM(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function hhmmToHours(value: string): number {
  const match = value.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h + m / 60;
}

export function normaliseInputRoles(next: QuoteInput, config: AppConfig): QuoteInput {
  const validRoles = config.rates.map((r) => r.role);
  const fallbackRole = validRoles[0] ?? "";

  return {
    ...next,
    labour: next.labour.map((line) => ({
      ...line,
      role: validRoles.includes(line.role) ? line.role : fallbackRole,
    })),
  };
}

export function sortLabourLinesByDate(labour: LabourLine[]): LabourLine[] {
  return [...labour].sort((a, b) => {
    const dateA = a.shiftDate || "";
    const dateB = b.shiftDate || "";

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const timeA = normaliseHHMM(a.startTime) ?? a.startTime ?? "";
    const timeB = normaliseHHMM(b.startTime) ?? b.startTime ?? "";

    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    return a.role.localeCompare(b.role);
  });
}

export function isQuoteEmpty(params: {
  input: QuoteInput;
  draftName: string;
  minBillableHours: number;
}): boolean {
  const { input, draftName, minBillableHours } = params;

  const hasHeaderData =
    (input.companyName || "").trim() !== "" ||
    (input.contactName || "").trim() !== "" ||
    (input.contactEmail || "").trim() !== "" ||
    (input.contactPhone || "").trim() !== "" ||
    (input.venue || "").trim() !== "" ||
    (input.notes || "").trim() !== "" ||
    ((draftName || "").trim() !== "" && draftName !== "Untitled Estimate");

  const hasLabourData = input.labour.some(
    (line) =>
      (line.role || "").trim() !== "" ||
      (line.notes || "").trim() !== "" ||
      (line.qty ?? 1) !== 1 ||
      (line.startTime || "") !== "08:00" ||
      (line.durationHours ?? minBillableHours) !== minBillableHours ||
      (line.shiftDate || "").trim() !== ""
  );

  const hasNonLabourData = input.nonLabour.some(
    (line) =>
      (line.description || "").trim() !== "" ||
      (line.amountExGst ?? 0) !== 0 ||
      (line.qty ?? 1) !== 1
  );

  return !hasHeaderData && !hasLabourData && !hasNonLabourData;
}
