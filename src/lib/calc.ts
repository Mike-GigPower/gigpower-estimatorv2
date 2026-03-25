import { defaultConfig } from "./config";
import type { AppConfig, LabourLine, QuoteInput, QuoteResult, RateRow } from "./types";

function parseTimeHHMM(t: string): { h: number; m: number } | null {
  const raw = (t ?? "").toString().trim();

  const m1 = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (m1) return { h: Number(m1[1]), m: Number(m1[2]) };

  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    const frac = asNum >= 0 && asNum < 1 ? asNum : asNum % 1;
    const totalMinutes = Math.round(frac * 24 * 60);
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

function getRateRow(role: string, config: AppConfig): RateRow | undefined {
  return config.rates.find((r) => r.role === role);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function splitIntoDayNightByDate(
  start: Date,
  end: Date,
  config: AppConfig
): Array<{ dateISO: string; dayHrs: number; nightHrs: number }> {
  const s = start.getTime();
  const e = end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return [];

  const out: Array<{ dateISO: string; dayHrs: number; nightHrs: number }> = [];

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

    const candidates = [dayStartDT, nightStartDT, nextMidnight]
      .map((dt) => dt.getTime())
      .filter((t) => t > curMs);

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

    out.push({
      dateISO,
      dayHrs: isDay ? segHours : 0,
      nightHrs: isDay ? 0 : segHours,
    });

    cursor = new Date(segEndMs);
  }

  return out;
}

function computeLineCost(
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
} {
  const errors: string[] = [];

  if (!line.role || !getRateRow(line.role, config)) errors.push(`Role is invalid for line ${line.id}.`);
  if (!Number.isFinite(line.qty) || line.qty <= 0) errors.push(`Crew qty must be > 0 for line ${line.id}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(line.shiftDate)) errors.push(`Shift date is invalid for line ${line.id}.`);

  const t = parseTimeHHMM(line.startTime);
  if (!t) errors.push(`Start time must be HH:MM for line ${line.id}.`);
  if (!Number.isFinite(line.durationHours) || line.durationHours <= 0) {
    errors.push(`Duration must be > 0 for line ${line.id}.`);
  }

  if (Number.isFinite(line.durationHours) && line.durationHours < config.minBillableHours) {
    errors.push(`Duration is below minimum (${config.minBillableHours}h) for line ${line.id}. (Will bill minimum)`);
  }

  const rateRow = getRateRow(line.role, config);
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
    };
  }

  const rr = rateRow;
  const billableHours = Math.max(line.durationHours, config.minBillableHours);
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
    };
  }

  const startDT = new Date(yy, mm - 1, dd, tt.h, tt.m, 0, 0);
  const endDT = new Date(startDT.getTime() + billableHours * 3600000);

  const baseEnd = new Date(Math.min(endDT.getTime(), startDT.getTime() + 8 * 3600000));
  const ot8End = new Date(Math.min(endDT.getTime(), startDT.getTime() + 10 * 3600000));

  const baseParts = splitIntoDayNightByDate(startDT, baseEnd, config);
  const ot8Parts = splitIntoDayNightByDate(baseEnd, ot8End, config);
  const ot10Parts = splitIntoDayNightByDate(ot8End, endDT, config);

  const sum = (arr: Array<{ dayHrs: number; nightHrs: number }>) => ({
    day: arr.reduce((a, x) => a + x.dayHrs, 0),
    night: arr.reduce((a, x) => a + x.nightHrs, 0),
  });

  const baseSum = sum(baseParts);
  const ot8Sum = sum(ot8Parts);
  const ot10Sum = sum(ot10Parts);

  function maxDay(dateISO: string): number {
    const sunday = isSunday(dateISO);
    const ph = isPublicHoliday(dateISO, config);
    return Math.max(rr.day, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0);
  }

  function maxNight(dateISO: string): number {
    const sunday = isSunday(dateISO);
    const ph = isPublicHoliday(dateISO, config);
    return Math.max(rr.night, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0);
  }

  function maxOt8Day(dateISO: string): number {
    const sunday = isSunday(dateISO);
    const ph = isPublicHoliday(dateISO, config);
    return Math.max(rr.over8, rr.day, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0);
  }

  function maxOt8Night(dateISO: string): number {
    const sunday = isSunday(dateISO);
    const ph = isPublicHoliday(dateISO, config);
    return Math.max(rr.over8, rr.night, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0);
  }

  function maxOt10Day(dateISO: string): number {
    const sunday = isSunday(dateISO);
    const ph = isPublicHoliday(dateISO, config);
    return Math.max(rr.over10, rr.day, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0);
  }

  function maxOt10Night(dateISO: string): number {
    const sunday = isSunday(dateISO);
    const ph = isPublicHoliday(dateISO, config);
    return Math.max(rr.over10, rr.night, sunday ? rr.sunday : 0, ph ? rr.publicHoliday : 0);
  }

  function costParts(
    parts: Array<{ dateISO: string; dayHrs: number; nightHrs: number }>,
    dayFn: (d: string) => number,
    nightFn: (d: string) => number
  ): number {
    return parts.reduce((acc, p) => acc + p.dayHrs * dayFn(p.dateISO) + p.nightHrs * nightFn(p.dateISO), 0);
  }

  const costBase = costParts(baseParts, maxDay, maxNight);
  const costOt8 = costParts(ot8Parts, maxOt8Day, maxOt8Night);
  const costOt10 = costParts(ot10Parts, maxOt10Day, maxOt10Night);

  const costExGst = round2(line.qty * (costBase + costOt8 + costOt10));

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
  };
}

export function estimateQuote(input: QuoteInput, config: AppConfig = defaultConfig): QuoteResult {
  const validationErrors: string[] = [];

  const labourLines = input.labour.map((line) => {
    const r = computeLineCost(line, config);
    return {
      id: line.id,
      role: line.role,
      qty: line.qty,
      shiftDate: line.shiftDate,
      startTime: line.startTime,
      durationHours: line.durationHours,
      billableHours: r.billableHours,
      costExGst: r.costExGst,
      gst: round2(r.costExGst * config.gstRate),
      totalIncGst: round2(r.costExGst * (1 + config.gstRate)),
      breakdown: r.breakdown,
    };
  });

  input.labour.forEach((l) => {
    const r = computeLineCost(l, config);
    if (!r.ok) validationErrors.push(...r.errors);
  });

  const nonLabourLines = input.nonLabour
    .filter((x) => (x.description || "").trim() !== "" || x.amountExGst !== 0 || x.qty !== 1)
    .map((x) => {
      const qty = Number.isFinite(x.qty) && x.qty > 0 ? x.qty : 1;
      const unit = round2(x.amountExGst);
      const line = round2(unit * qty);
      return {
        id: x.id,
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