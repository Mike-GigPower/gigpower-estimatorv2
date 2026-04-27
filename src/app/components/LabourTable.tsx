import LabourRow from "./LabourRow";

import type { LabourLine } from "@/src/lib/estimator";

type LabourResultLine = {
  id: string;
  costExGst: number;
  totalIncGst: number;
};

type LabourResult = {
  isValid: boolean;
  validationErrors: string[];
  labourLines: LabourResultLine[];
};

type LabourTableProps = {
  labour: LabourLine[];
  result?: LabourResult | null;
  roleOptions: string[];
  startTimeText: Record<string, string>;
  setStartTimeText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  durationText: Record<string, string>;
  setDurationText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateLabour: (id: string, patch: Partial<LabourLine>) => void;
  addLabour: () => void;
  duplicateLabour: (id: string) => void;
  removeLabour: (id: string) => void;
  sortLabourByDate: () => void;
  formatDateDDMMYYYY: (date: Date) => string;
  normaliseHHMM: (value: string) => string | null;
  hoursToHHMM: (hours: number) => string;
  autoColonHHMM: (value: string) => string;
  money: (value: number) => string;
  minBillableHours: number;
};

export default function LabourTable({
  labour,
  result,
  roleOptions,
  startTimeText,
  setStartTimeText,
  durationText,
  setDurationText,
  updateLabour,
  addLabour,
  duplicateLabour,
  removeLabour,
  sortLabourByDate,
  formatDateDDMMYYYY,
  normaliseHHMM,
  hoursToHHMM,
  autoColonHHMM,
  money,
  minBillableHours,
}: LabourTableProps) {
  const labourResultById = Object.fromEntries(
    (result?.labourLines ?? []).map((line) => [line.id, line])
  );

  function parseStartTime(value: string): string | null {
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

  function parseDurationHours(value: string): number | null {
    const raw = value.trim();

    const hhmm = raw.match(/^(\d{1,2}):([0-5]\d)$/);
    if (hhmm) {
      const h = Number(hhmm[1]);
      const mins = Number(hhmm[2]);
      return h + mins / 60;
    }

    if (/^\d+(\.\d+)?$/.test(raw)) {
      const hours = Number(raw);
      if (!Number.isNaN(hours) && hours > 0) return hours;
    }

    return null;
  }

  const hasInvalidStartTimeDraft = labour.some((line) => {
    const draft = startTimeText[line.id];
    return typeof draft === "string" && draft.trim() !== "" && parseStartTime(draft) === null;
  });

  const hasInvalidDurationDraft = labour.some((line) => {
    const draft = durationText[line.id];
    if (typeof draft !== "string" || draft.trim() === "") return false;

    const parsed = parseDurationHours(draft);
    return parsed !== null && parsed < minBillableHours;
  });

  const showFixInputs =
    (result && !result.isValid) || hasInvalidStartTimeDraft || hasInvalidDurationDraft;

  return (
   <div className="card labour-card">
  <div className="row labour-header-row">
    <h2 style={{ margin: 0, fontSize: 16 }}>Labour</h2>
    <div className="no-print labour-actions">
      <button type="button" className="btn-secondary" onClick={sortLabourByDate}>
        Sort by date
      </button>
      <button type="button" onClick={addLabour}>
        + Add labour line
      </button>
    </div>
  </div>

  <p className="print-labour-note print-only">
    Large estimates may continue onto subsequent pages.
  </p>


      <div className="labour-table-wrap">
        <table className="entry-table labour-table print-labour-table">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Role</th>
              <th style={{ minWidth: 70 }}>Qty</th>
              <th style={{ minWidth: 110 }}>
                <span className="th-top">Shift</span>
                <span className="th-sub">Date</span>
              </th>
              <th style={{ minWidth: 80 }}>
                <span className="th-top">Start</span>
                <span className="th-sub">24h</span>
              </th>
              <th style={{ minWidth: 90 }}>
                <span className="th-top">Duration</span>
                <span className="th-sub">HH:MM</span>
              </th>
              <th style={{ minWidth: 100 }} className="text-right">
                <span className="th-top">Cost</span>
                <span className="th-sub">ex GST</span>
              </th>
              <th style={{ minWidth: 110 }} className="text-right">
                <span className="th-top">Total</span>
                <span className="th-sub">inc GST</span>
              </th>
              <th style={{ minWidth: 60 }}></th>
            </tr>
          </thead>

          <tbody>
            {labour.map((line, idx) => (
              <LabourRow
  key={line.id}
  line={line}
  resultLine={labourResultById[line.id]}
  roleOptions={roleOptions}
  startTimeText={startTimeText}
  setStartTimeText={setStartTimeText}
  durationText={durationText}
  setDurationText={setDurationText}
  updateLabour={updateLabour}
  duplicateLabour={duplicateLabour}
  removeLabour={removeLabour}
  addLabour={addLabour}
  isLastRow={idx === labour.length - 1}
  formatDateDDMMYYYY={formatDateDDMMYYYY}
  normaliseHHMM={normaliseHHMM}
  hoursToHHMM={hoursToHHMM}
  autoColonHHMM={autoColonHHMM}
  money={money}
  minBillableHours={minBillableHours}
/>
            ))}
          </tbody>
        </table>
      </div>

      {showFixInputs && (
        <div style={{ marginTop: 12 }}>
          <div className="badge bad">Fix inputs</div>

          <p className="muted" style={{ marginTop: 8, marginBottom: 6 }}>
            Some entries need attention. Please review the highlighted fields.
          </p>

          <small className="muted" style={{ display: "block", marginTop: 6 }}>
            Start times must be valid 24-hour times, and labour durations must be at least{" "}
            {minBillableHours} hours.
          </small>
        </div>
      )}
    </div>
  );
}