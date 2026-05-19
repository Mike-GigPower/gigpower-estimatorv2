import { Fragment } from "react";
import LabourRow from "./LabourRow";
import { parseStartTime, parseDurationHours } from "@/src/lib/estimator/calc";

/**
 * Format a YYYY-MM-DD shift date as "Mon 23 Jun 2026" for the day
 * separator label. Returns the raw value back if it isn't parseable.
 */
function formatDaySeparatorLabel(shiftDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return shiftDate;
  const d = new Date(`${shiftDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return shiftDate;

  const weekday = d.toLocaleDateString("en-AU", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-AU", { month: "short" });
  const year = d.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
}

type LabourLine = {
  id: string;
  role: string;
  qty: number;
  shiftDate: string;
  startTime: string;
  durationHours: number;
};

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
  isAdmin?: boolean;
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
  isAdmin,
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
              <th style={{ width: 32, minWidth: 32 }} className="labour-row-num-head">
      <span className="no-print">#</span>
    </th>
              <th style={{ minWidth: 200 }}>
                {/* Screen: editable Call Name. Print: derived rate role. */}
                <span className="no-print">Call Name</span>
                <span className="print-only">Role</span>
              </th>
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
            {labour.map((line, idx) => {
              const prev = idx > 0 ? labour[idx - 1] : null;
              const isFirstOfDay = !prev || prev.shiftDate !== line.shiftDate;

              return (
               <Fragment key={line.id}>
                  {isFirstOfDay && line.shiftDate && (
                    <tr className="labour-day-separator no-print" aria-hidden="true">
                      <td colSpan={9}>
                        <div className="labour-day-separator-inner">
                          <span className="labour-day-separator-label">
                            {formatDaySeparatorLabel(line.shiftDate)}
                          </span>
                          <span className="labour-day-separator-line" />
                        </div>
                      </td>
                    </tr>
                  )}
                  <LabourRow
                    line={line}
                    resultLine={labourResultById[line.id]}
                    rowNumber={idx + 1}
                    roleOptions={roleOptions}
                    startTimeText={startTimeText}
                    setStartTimeText={setStartTimeText}
                    isAdmin={isAdmin}
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
                </Fragment>
              );
            })}
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
            Each line needs a Call Name. Start times must be valid 24-hour times, and labour durations must be at least{" "}
            {minBillableHours} hours.
          </small>
        </div>
      )}
    </div>
  );
}
