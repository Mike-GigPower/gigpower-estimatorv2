import type { LabourLine } from "./types";

export function sortLabourByDate(lines: LabourLine[]) {
  return [...lines].sort((a, b) => {
    const dateCompare = (a.shiftDate || "").localeCompare(b.shiftDate || "");

    if (dateCompare !== 0) return dateCompare;

    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}

export function shouldGroupLabourByDate(lines: LabourLine[]) {
  const uniqueDates = new Set(
    lines.map((line) => line.shiftDate).filter(Boolean)
  );

  return lines.length > 5 && uniqueDates.size > 1;
}

export function groupLabourByDate(lines: LabourLine[]) {
  const sorted = sortLabourByDate(lines);

  return sorted.reduce<Record<string, LabourLine[]>>((groups, line) => {
    const date = line.shiftDate || "No date";

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(line);
    return groups;
  }, {});
}