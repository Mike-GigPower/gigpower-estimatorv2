import type { LabourLine, NonLabourLine, QuoteInput } from "./types";

export function isValidDate(value: string): boolean {
  if (!value) return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function isValidStartTime(value: string): boolean {
  if (!value) return false;

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidDurationHours(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isValidLabourLine(line: LabourLine): boolean {
  return Boolean(
    line.role &&
      line.qty > 0 &&
      isValidDate(line.shiftDate) &&
      isValidStartTime(line.startTime) &&
      isValidDurationHours(line.durationHours)
  );
}

export function isValidNonLabourLine(line: NonLabourLine): boolean {
  return Boolean(
    line.description &&
      line.qty > 0 &&
      Number.isFinite(line.amountExGst) &&
      line.amountExGst >= 0
  );
}

export function validateQuoteInput(input: QuoteInput): string[] {
  const errors: string[] = [];

  if (!input.companyName?.trim()) {
    errors.push("Company name is required.");
  }

  if (!input.contactName?.trim()) {
    errors.push("Contact name is required.");
  }

  if (!input.venue?.trim()) {
    errors.push("Venue is required.");
  }

  input.labour.forEach((line, index) => {
    if (!isValidLabourLine(line)) {
      errors.push(`Labour line ${index + 1} is incomplete or invalid.`);
    }
  });

  input.nonLabour.forEach((line, index) => {
    if (!isValidNonLabourLine(line)) {
      errors.push(`Non-labour line ${index + 1} is incomplete or invalid.`);
    }
  });

  return errors;
}