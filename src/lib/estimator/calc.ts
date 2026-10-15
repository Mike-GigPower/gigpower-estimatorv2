import type { AppConfig, LabourLine, LabourCostSegment, QuoteInput } from "./types";
import type { RateRow } from "../types";
import { roleForCallName } from "../types";
import { isCallNameOnCard, ratesForQuote } from "../rateCards";

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

/**
 * Keep each labour line's role consistent with the quote's rate card.
 *
 * - A line whose stored role is on the card keeps it (unless `rederive`), so
 *   saved quotes keep their historical pricing (see DECISIONS: Wardrobe).
 * - Otherwise, and always when `rederive` is set (the card was just changed),
 *   the role is re-derived from the call name under the card.
 * - A line whose call name the card doesn't offer (e.g. Load In after MOPT is
 *   ticked, or Field of Play Operations after Australian Open is set to No) keeps its call name AND role; the caller
 *   flags it and the engine reports its role as invalid. It is never priced
 *   as something else.
 * - A line with no call name (legacy) keeps its role; an unknown role is
 *   reported by the engine. A role is never replaced with "the first role".
 * - While the card isn't priceable (Australian Open unanswered) lines are
 *   left as they are.
 */
export function normaliseInputRoles(
  next: QuoteInput,
  config: AppConfig,
  opts: { rederive?: boolean } = {}
): QuoteInput {
  const labour = Array.isArray(next.labour) ? next.labour : [];
  const cardRates = ratesForQuote(config, next.rateCard);
  if (!cardRates) return { ...next, labour };

  const cardRoles = new Set(cardRates.map((r) => r.role));

  return {
    ...next,
    labour: labour.map((line) => {
      const callName = line.callName || "";
      if (!callName) return line;
      if (!isCallNameOnCard(callName, next.rateCard, cardRates)) return line;
      if (!opts.rederive && cardRoles.has(line.role)) return line;
      const role = roleForCallName(callName, cardRates);
      return role === line.role ? line : { ...line, role };
    }),
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
  const { input, draftName } = params;

  const hasHeaderData =
    (input.companyName || "").trim() !== "" ||
    (input.contactName || "").trim() !== "" ||
    (input.contactEmail || "").trim() !== "" ||
    (input.contactPhone || "").trim() !== "" ||
    (input.venue || "").trim() !== "" ||
    (input.notes || "").trim() !== "" ||
    ((draftName || "").trim() !== "" && draftName !== "Untitled Estimate");
// A labour line counts as user-entered data when the user has actually
  // picked a Call Name or changed a field — NOT when it merely carries an
  // auto-derived/default role. Role is now derived from Call Name via
  // roleForCallName() and falls back to "Standard Crew", and the
  // resetToBlankQuote() factory seeds the first line with the first rate
  // role, so testing `role` here would flag a brand-new blank quote as
  // non-empty and wrongly trigger the "Unsaved Changes" dialog.
  const hasLabourData = input.labour.some(
    (line) =>
      (line.callName || "").trim() !== "" ||
      (line.notes || "").trim() !== "" ||
      (line.qty ?? 1) !== 1
  );

  const hasNonLabourData = input.nonLabour.some(
    (line) =>
      (line.title || "").trim() !== "" ||
      (line.description || "").trim() !== "" ||
      (line.amountExGst ?? 0) !== 0 ||
      (line.qty ?? 1) !== 1
  );

  return !hasHeaderData && !hasLabourData && !hasNonLabourData;
}


function parseTimeHHMM(t: string): { h: number; m: number } | null {
  const raw = (t ?? "").toString().trim();

  const m1 = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (m1) return { h: Number(m1[1]), m: Number(m1[2]) };

  // Numeric fallback (e.g. a decimal fraction of a day). Guard against empty
  // or whitespace-only input: Number("") and Number("   ") evaluate to 0,
  // which would otherwise be parsed as midnight (00:00) and let a line with
  // no start time be priced instead of flagged invalid. Require at least one
  // digit before attempting numeric coercion.
  if (!/\d/.test(raw)) return null;

  // Only a true fraction of a day (0 <= n < 1) is accepted, e.g. 0.5 -> 12:00.
  // The previous `asNum % 1` fallback mapped any bare integer to midnight, so
  // "8" priced a full shift from 00:00 at night rates rather than 08:00 at day
  // rates — a ~27% over-quote that raised no validation error because the
  // parse succeeded. A bare integer now returns null and is caught by the
  // "Start time must be HH:MM" check in calculateLabourLine.
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum >= 0 && asNum < 1) {
    const totalMinutes = Math.round(asNum * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
  }

  return null;
}

function isSunday(dateISO: string): boolean {
  const d = new Date(dateISO + "T00:00:00");
  return d.getDay() === 0;
}

function isPublicHoliday(dateISO: string, config: AppConfig): boolean {
  return config.publicHolidays.some((h) => h.date === dateISO);
}

// Pick the rate version that applies to a given shift date: the one whose
// effective_from is the LATEST date still on or before the shift date. If the
// shift date falls before every version (e.g. legacy edge data), fall back to
// the earliest version so there are never gaps. ISO YYYY-MM-DD dates compare
// correctly as plain strings.
function getRateRow(role: string, shiftDate: string, config: AppConfig) {
  return rateRowFor(role, shiftDate, config.rates);
}

function rateRowFor(role: string, shiftDate: string, rates: readonly RateRow[]) {
  const candidates = rates.filter((r) => r.role === role);
  if (candidates.length === 0) return undefined;

  const applicable = candidates
    .filter((r) => !r.effectiveFrom || r.effectiveFrom <= shiftDate)
    .sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));

  if (applicable.length > 0) return applicable[0];

  return [...candidates].sort((a, b) =>
    (a.effectiveFrom || "").localeCompare(b.effectiveFrom || "")
  )[0];
}

/**
 * The minimum billable hours for a line (S-3): the role's own minimum on the
 * rate version for its shift date, else the global setting. The UI uses this
 * to gate durations the same way calculateLabourLine bills them.
 */
export function minBillableHoursFor(
  role: string,
  shiftDate: string,
  rates: readonly RateRow[],
  globalMinBillableHours: number
): number {
  return rateRowFor(role, shiftDate, rates)?.minBillableHours ?? globalMinBillableHours;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// A slice of a shift that is wholly day or night, on one date, and wholly
// inside or outside every double-penalty window. multiplier is 1 outside any
// window; windowName is set only inside one.
type ShiftPart = {
  dateISO: string;
  dayHrs: number;
  nightHrs: number;
  multiplier: number;
  windowName?: string;
};

// The D31 windows that can touch a date in year y: those starting in y and
// in y - 1, so 1 Jan picks up the New Year window that began on 31 Dec. An
// endMd before startMd ends in the following year. Built wall-clock with
// new Date(y, m, d, h, min), like the day/night boundaries.
function windowsAround(
  y: number,
  config: AppConfig
): Array<{ startMs: number; endMs: number; name: string; multiplier: number }> {
  const out: Array<{ startMs: number; endMs: number; name: string; multiplier: number }> = [];
  for (const w of config.doublePenaltyWindows ?? []) {
    const sMd = /^(\d{2})-(\d{2})$/.exec(w.startMd);
    const eMd = /^(\d{2})-(\d{2})$/.exec(w.endMd);
    const sT = parseTimeHHMM(w.startTime);
    const eT = parseTimeHHMM(w.endTime);
    if (!sMd || !eMd || !sT || !eT || !(w.multiplier > 1)) continue;
    const endYearOffset = w.endMd < w.startMd ? 1 : 0;
    for (const year of [y - 1, y]) {
      const startMs = new Date(year, Number(sMd[1]) - 1, Number(sMd[2]), sT.h, sT.m, 0, 0).getTime();
      const endMs = new Date(
        year + endYearOffset,
        Number(eMd[1]) - 1,
        Number(eMd[2]),
        eT.h,
        eT.m,
        0,
        0
      ).getTime();
      if (endMs > startMs) out.push({ startMs, endMs, name: w.name, multiplier: w.multiplier });
    }
  }
  return out;
}

function splitIntoDayNightByDate(
  start: Date,
  end: Date,
  config: AppConfig
): ShiftPart[] {
  const s = start.getTime();
  const e = end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return [];

  const out: ShiftPart[] = [];

  const dayStart = parseTimeHHMM(config.dayStart) ?? { h: 8, m: 0 };
  const nightStart = parseTimeHHMM(config.nightStart) ?? { h: 20, m: 0 };

  const msPerHour = 3600000;
  let guard = 0;
  let cursor = new Date(s);

  while (cursor.getTime() < e) {
    guard++;
    if (guard > 96) break;

    const curMs = cursor.getTime();
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const d = cursor.getDate();

    const dayStartDT = new Date(y, m, d, dayStart.h, dayStart.m, 0, 0);
    const nightStartDT = new Date(y, m, d, nightStart.h, nightStart.m, 0, 0);
    const nextMidnight = new Date(y, m, d + 1, 0, 0, 0, 0);
    const windows = windowsAround(y, config);

    // Also cut at every window edge, so each part lies wholly inside or
    // outside each window.
    const candidates = [
      ...[dayStartDT, nightStartDT, nextMidnight].map((dt) => dt.getTime()),
      ...windows.flatMap((w) => [w.startMs, w.endMs]),
    ].filter((t) => t > curMs);

    const nextBoundaryMs = candidates.length ? Math.min(...candidates) : nextMidnight.getTime();
    const segEndMs = Math.min(e, nextBoundaryMs);

    if (!Number.isFinite(segEndMs) || segEndMs <= curMs) {
      const forced = Math.min(e, curMs + 60000);
      if (forced <= curMs) break;
      cursor = new Date(forced);
      continue;
    }

    const segHours = (segEndMs - curMs) / msPerHour;
    const dateISO = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const isDay = curMs >= dayStartDT.getTime() && curMs < nightStartDT.getTime();

    // Overlapping windows: the highest multiplier wins.
    let inWindow: { name: string; multiplier: number } | undefined;
    for (const w of windows) {
      if (curMs >= w.startMs && curMs < w.endMs && w.multiplier > (inWindow?.multiplier ?? 1)) {
        inWindow = w;
      }
    }

    out.push({
      dateISO,
      dayHrs: isDay ? segHours : 0,
      nightHrs: isDay ? 0 : segHours,
      multiplier: inWindow?.multiplier ?? 1,
      ...(inWindow ? { windowName: inWindow.name } : {}),
    });

    cursor = new Date(segEndMs);
  }

  return out;
}

export function calculateLabourLine(
  line: LabourLine,
  config: AppConfig
): {
  ok: boolean;
  errors: string[];
  billableHours: number;
  costExGst: number;
  breakdown: {
    baseDayHrs: number;
    baseNightHrs: number;
    ot8DayHrs: number;
    ot8NightHrs: number;
    ot10DayHrs: number;
    ot10NightHrs: number;
  };
  segments: LabourCostSegment[];
} {
  const errors: string[] = [];

  if (!line.role || !getRateRow(line.role, line.shiftDate, config)) errors.push(`Role is invalid for line ${line.id}.`);
  if (!Number.isFinite(line.qty) || line.qty <= 0) errors.push(`Crew qty must be > 0 for line ${line.id}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(line.shiftDate)) errors.push(`Shift date is invalid for line ${line.id}.`);

  const t = parseTimeHHMM(line.startTime);
  if (!t) errors.push(`Start time must be HH:MM for line ${line.id}.`);
  if (!Number.isFinite(line.durationHours) || line.durationHours <= 0) {
    errors.push(`Duration must be > 0 for line ${line.id}.`);
  }

  const rateRow = getRateRow(line.role, line.shiftDate, config);
  // S-3: the role's own minimum, else the global one.
  const minBillableHours = Number(rateRow?.minBillableHours ?? config.minBillableHours ?? 0);

  if (Number.isFinite(line.durationHours) && line.durationHours < minBillableHours) {
    errors.push(`Duration is below minimum (${minBillableHours}h) for line ${line.id}. (Will bill minimum)`);
  }

  const fatalErrors = errors.filter((e) => !e.includes("below minimum"));

  if (!rateRow || fatalErrors.length) {
    return {
      ok: false,
      errors: fatalErrors.length ? fatalErrors : errors,
      billableHours: 0,
      costExGst: 0,
      breakdown: {
        baseDayHrs: 0,
        baseNightHrs: 0,
        ot8DayHrs: 0,
        ot8NightHrs: 0,
        ot10DayHrs: 0,
        ot10NightHrs: 0,
      },
      segments: [],
    };
  }

  const rr = rateRow;
  const billableHours = Math.max(
    Number(line.durationHours || 0),
    minBillableHours
  );
  const [yy, mm, dd] = line.shiftDate.split("-").map(Number);
  const tt = parseTimeHHMM(line.startTime);

  if (!tt || !Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) {
    return {
      ok: false,
      errors: [`Invalid date/time for line ${line.id}.`],
      billableHours: 0,
      costExGst: 0,
      breakdown: {
        baseDayHrs: 0,
        baseNightHrs: 0,
        ot8DayHrs: 0,
        ot8NightHrs: 0,
        ot10DayHrs: 0,
        ot10NightHrs: 0,
      },
      segments: [],
    };
  }

  const startDT = new Date(yy, mm - 1, dd, tt.h, tt.m, 0, 0);
  const endDT = new Date(startDT.getTime() + billableHours * 3600000);

  const baseEnd = new Date(Math.min(endDT.getTime(), startDT.getTime() + 8 * 3600000));
  const ot8End = new Date(Math.min(endDT.getTime(), startDT.getTime() + 10 * 3600000));

  const baseParts = splitIntoDayNightByDate(startDT, baseEnd, config);
  const ot8Parts = splitIntoDayNightByDate(baseEnd, ot8End, config);
  const ot10Parts = splitIntoDayNightByDate(ot8End, endDT, config);

  const sum = (arr: ShiftPart[]) => ({
    day: arr.reduce((a, x) => a + x.dayHrs, 0),
    night: arr.reduce((a, x) => a + x.nightHrs, 0),
  });

  const baseSum = sum(baseParts);
  const ot8Sum = sum(ot8Parts);
  const ot10Sum = sum(ot10Parts);

  // D31: inside a window every tier, day and night, is at least multiplier ×
  // the role's public holiday rate (Sunday if it has none), holiday or not.
  // Outside a window this is 0, so the max below is unchanged.
  const windowBaseRate = rr.publicHoliday > 0 ? rr.publicHoliday : rr.sunday;
  function windowRate(p: ShiftPart): number {
    return p.multiplier > 1 ? p.multiplier * windowBaseRate : 0;
  }

  function maxDay(p: ShiftPart): number {
    const sunday = isSunday(p.dateISO);
    const ph = isPublicHoliday(p.dateISO, config);
    return Math.max(rr.day, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0, windowRate(p));
  }

  function maxNight(p: ShiftPart): number {
    const sunday = isSunday(p.dateISO);
    const ph = isPublicHoliday(p.dateISO, config);
    return Math.max(rr.night, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0, windowRate(p));
  }

  // A null over8/over10 means the card has no such tier: it contributes 0 to
  // the max, so the base (or Sunday/PH) rate applies. Same result as a tier
  // equal to the base rate; see calc.test.ts.
  function maxOt8Day(p: ShiftPart): number {
    const sunday = isSunday(p.dateISO);
    const ph = isPublicHoliday(p.dateISO, config);
    return Math.max(rr.over8 ?? 0, rr.day, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0, windowRate(p));
  }

  function maxOt8Night(p: ShiftPart): number {
    const sunday = isSunday(p.dateISO);
    const ph = isPublicHoliday(p.dateISO, config);
    return Math.max(rr.over8 ?? 0, rr.night, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0, windowRate(p));
  }

  function maxOt10Day(p: ShiftPart): number {
    const sunday = isSunday(p.dateISO);
    const ph = isPublicHoliday(p.dateISO, config);
    return Math.max(rr.over10 ?? 0, rr.day, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0, windowRate(p));
  }

  function maxOt10Night(p: ShiftPart): number {
    const sunday = isSunday(p.dateISO);
    const ph = isPublicHoliday(p.dateISO, config);
    return Math.max(rr.over10 ?? 0, rr.night, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0, windowRate(p));
  }

  function costParts(
    parts: ShiftPart[],
    dayFn: (p: ShiftPart) => number,
    nightFn: (p: ShiftPart) => number
  ): number {
    return parts.reduce((acc, p) => acc + p.dayHrs * dayFn(p) + p.nightHrs * nightFn(p), 0);
  }

  const costBase = costParts(baseParts, maxDay, maxNight);
  const costOt8 = costParts(ot8Parts, maxOt8Day, maxOt8Night);
  const costOt10 = costParts(ot10Parts, maxOt10Day, maxOt10Night);

  const costExGst = round2(line.qty * (costBase + costOt8 + costOt10));

  // Build the per-crew cost breakdown segments that drive the hover tooltip on
  // the Cost column. Each segment is one (tier, period, date) slice with hours
  // greater than zero; costExGst here is PER CREW (hours × rate, not × qty), so
  // the UI sums them to the per-crew subtotal and multiplies by qty for the
  // line total. The rate functions and parts arrays are exactly those used to
  // compute the costs above, so the segments always reconcile with costExGst.
  function buildSegments(
    tier: "base" | "ot8" | "ot10",
    parts: ShiftPart[],
    dayFn: (p: ShiftPart) => number,
    nightFn: (p: ShiftPart) => number
  ): LabourCostSegment[] {
    const out: LabourCostSegment[] = [];

    // Window fields only inside a window, so segments outside one are
    // unchanged.
    const windowFields = (p: ShiftPart) =>
      p.windowName !== undefined
        ? { doublePenalty: true, windowName: p.windowName, multiplier: p.multiplier }
        : {};

    for (const p of parts) {
      if (p.dayHrs > 0) {
        const rate = dayFn(p);
        out.push({
          tier,
          period: "day",
          dateISO: p.dateISO,
          hours: round2(p.dayHrs),
          rate,
          costExGst: round2(p.dayHrs * rate),
          ...windowFields(p),
        });
      }
      if (p.nightHrs > 0) {
        const rate = nightFn(p);
        out.push({
          tier,
          period: "night",
          dateISO: p.dateISO,
          hours: round2(p.nightHrs),
          rate,
          costExGst: round2(p.nightHrs * rate),
          ...windowFields(p),
        });
      }
    }

    return out;
  }

  const segments: LabourCostSegment[] = [
    ...buildSegments("base", baseParts, maxDay, maxNight),
    ...buildSegments("ot8", ot8Parts, maxOt8Day, maxOt8Night),
    ...buildSegments("ot10", ot10Parts, maxOt10Day, maxOt10Night),
  ];

  return {
    ok: true,
    errors: [],
    billableHours,
    costExGst,
    breakdown: {
      baseDayHrs: round2(baseSum.day),
      baseNightHrs: round2(baseSum.night),
      ot8DayHrs: round2(ot8Sum.day),
      ot8NightHrs: round2(ot8Sum.night),
      ot10DayHrs: round2(ot10Sum.day),
      ot10NightHrs: round2(ot10Sum.night),
    },
    segments,
  };
}

export function calculateQuoteTotals(input: QuoteInput, config: AppConfig) {
  const labourEvaluations = input.labour.map((line) => {
    const r = calculateLabourLine(line, config);
    return {
      line,
      result: r,
    };
  });
  
  

  const labourLines = labourEvaluations.map(({ line, result }) => ({
    id: line.id,
    role: line.role,
    qty: line.qty,
    shiftDate: line.shiftDate,
    startTime: line.startTime,
    durationHours: line.durationHours,
    billableHours: result.billableHours,
    costExGst: result.costExGst,
    gst: round2(result.costExGst * config.gstRate),
    totalIncGst: round2(result.costExGst * (1 + config.gstRate)),
    breakdown: result.breakdown,
    segments: result.segments,
  }));

  const validationErrors = labourEvaluations.flatMap(({ result }) =>
    result.ok ? [] : result.errors
  );

  const nonLabourLines = input.nonLabour
    .filter((x) => (x.title || "").trim() !== "" || (x.description || "").trim() !== "" || x.amountExGst !== 0 || x.qty !== 1)
    .map((x) => {
      const qty = Number.isFinite(x.qty) && x.qty > 0 ? x.qty : 1;
      const unit = round2(x.amountExGst);
      const line = round2(unit * qty);
      return {
        id: x.id,
        title: (x.title || "").trim(),
        description: x.description.trim() || "Non-labour item",
        qty,
        unitAmountExGst: unit,
        lineAmountExGst: line,
        gst: round2(line * config.gstRate),
        totalIncGst: round2(line * (1 + config.gstRate)),
      };
    });

  const labourExGst = round2(labourLines.reduce((a, x) => a + x.costExGst, 0));
  const nonLabourExGst = round2(nonLabourLines.reduce((a, x) => a + x.lineAmountExGst, 0));
  const subTotalExGst = round2(labourExGst + nonLabourExGst);
  const gst = round2(subTotalExGst * config.gstRate);
  const grandTotalIncGst = round2(subTotalExGst + gst);

  return {
    isValid: validationErrors.length === 0,
    validationErrors,
    labourLines,
    nonLabourLines,
    totals: {
      labourExGst,
      nonLabourExGst,
      subTotalExGst,
      gst,
      grandTotalIncGst,
    },
  };
}

export function parseStartTime(value: string): string | null {
  const raw = value.trim().toLowerCase();

  let normalized: string | null = null;

  const compact = raw.replace(/\s+/g, "");
  const isAM = compact.includes("am");
  const isPM = compact.includes("pm");
  const cleaned = compact.replace(/am|pm/g, "");

  let match = cleaned.match(/^(\d{1,2})[:\.](\d{2})$/);
  if (match) {
    let hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (minutes >= 0 && minutes < 60) {
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      if (hours >= 0 && hours <= 23) {
        normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    }
  }

  if (!normalized) {
    match = cleaned.match(/^(\d{3,4})$/);
    if (match) {
      const digits = match[1].padStart(4, "0");
      let hours = Number(digits.slice(0, 2));
      const minutes = Number(digits.slice(2, 4));

      if (minutes >= 0 && minutes < 60) {
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        if (hours >= 0 && hours <= 23) {
          normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        }
      }
    }
  }

  if (!normalized) {
    match = cleaned.match(/^(\d{1,2})$/);
    if (match) {
      let hours = Number(match[1]);
      const minutes = 0;

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      if (hours >= 0 && hours <= 23) {
        normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    }
  }

  return normalized;
}

export function parseDurationHours(value: string): number | null {
  const raw = value.trim();

  const hhmm = raw.match(/^(\d{1,2}):([0-5]\d)$/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const mins = Number(hhmm[2]);
    return h + mins / 60;
  }

  if (/^\d*\.?\d+$/.test(raw)) {
    const hours = Number(raw);
    if (!Number.isNaN(hours) && hours > 0) return hours;
  }

  return null;
}

export function calculateNonLabourLine(
  qty: number,
  amountExGst: number
) {
  const safeQty = qty || 0;
  const safeAmount = amountExGst || 0;

  return safeQty * safeAmount;
}