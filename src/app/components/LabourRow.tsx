import React from "react";

import type { LabourLine } from "@/src/lib/estimator";
import {
  ESTIMATOR_UI_CALL_NAMES,
  roleForCallName,
  type CrewFinderCallName,
} from "@/src/lib/types";

import {
  parseDurationHours,
  parseStartTime,
} from "@/src/lib/estimator/calc";

type LabourResultLine = {
  id: string;
  costExGst: number;
  totalIncGst: number;
};

type LabourRowProps = {
  line: LabourLine;
  resultLine?: LabourResultLine;
  rowNumber: number; 
  /**
   * Kept on the props for backwards compatibility with LabourTable. The role
   * field is no longer user-selectable, so the list is unused inside the row,
   * but removing it from the prop signature would require a wider refactor.
   */
  roleOptions: string[];
  startTimeText: Record<string, string>;
  setStartTimeText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isAdmin?: boolean;
  durationText: Record<string, string>;
  setDurationText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateLabour: (id: string, patch: Partial<LabourLine>) => void;
  duplicateLabour: (id: string) => void;
  removeLabour: (id: string) => void;
  addLabour: () => void;
  isLastRow: boolean;
  formatDateDDMMYYYY: (date: Date) => string;
  normaliseHHMM: (value: string) => string | null;
  hoursToHHMM: (hours: number) => string;
  autoColonHHMM: (value: string) => string;
  money: (value: number) => string;
  minBillableHours: number;
};

export default function LabourRow({
  line,
  resultLine,
   rowNumber, 
  roleOptions: _roleOptions,
  startTimeText,
  setStartTimeText,
  isAdmin,
  durationText,
  setDurationText,
  updateLabour,
  duplicateLabour,
  removeLabour,
  addLabour,
  isLastRow,
  formatDateDDMMYYYY,
  normaliseHHMM,
  hoursToHHMM,
  autoColonHHMM,
  money,
  minBillableHours,
}: LabourRowProps) {
  const [notesExpanded, setNotesExpanded] = React.useState(false);
const showNotes = notesExpanded || !!(line.notes && line.notes.trim());
  function focusNext(current: HTMLElement) {
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        'select:not([disabled]), input:not([disabled]), textarea:not([disabled]), button:not([disabled])'
      )
    ).filter((el) => el.offsetParent !== null);

    const index = focusable.indexOf(current);
    if (index >= 0 && index < focusable.length - 1) {
      focusable[index + 1].focus();
    }
  }

  function parseDurationHours(value: string): number | null {
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

  const durationDraft = durationText[line.id];
  const durationDraftInvalid =
    !isAdmin &&
    typeof durationDraft === "string" &&
    durationDraft.trim() !== "" &&
    (() => {
      const parsed = parseDurationHours(durationDraft);
      return parsed !== null && parsed < minBillableHours;
    })();

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

  const shiftDateInvalid = (() => {
    if (!line.shiftDate || !/^\d{4}-\d{2}-\d{2}$/.test(line.shiftDate)) return true;

    const d = new Date(`${line.shiftDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return true;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}` !== line.shiftDate;
  })();

  const startTimeDraft = startTimeText[line.id];
  const startTimeInvalid =
    typeof startTimeDraft === "string" &&
    startTimeDraft.trim() !== "" &&
    parseStartTime(startTimeDraft) === null;

  // Call Name is required input — drives the field-level red border below.
  const callNameMissing = !line.callName;

  // Row invalid means we can't price it. Missing Call Name doesn't block pricing
  // when role is already set (legacy rows where role pre-dates Call Name).
  const roleMissing = !line.role;
  const rowInvalid =
    shiftDateInvalid || startTimeInvalid || durationDraftInvalid || roleMissing;

  function handleCallNameChange(nextCallName: string) {
    const typedCallName = nextCallName as CrewFinderCallName | "";
    updateLabour(line.id, {
      callName: typedCallName,
      role: roleForCallName(typedCallName),
    });
  }

  return (
    <>
      <tr>
        <td className="labour-row-num">
    <span>{rowNumber}</span>
  </td>
        <td>
          <div className="labour-role-cell">
            <span className="print-only">
              {line.role}
              {line.notes ? ` — ${line.notes}` : ""}
            </span>
            <select
              className={`no-print labour-role-select${callNameMissing ? " field-error" : ""}`}
              data-row-id={line.id}
              data-col="callName"
              value={line.callName || ""}
              onChange={(e) => handleCallNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  focusNext(e.currentTarget);
                }
              }}
            >
              <option value="" disabled>— Select Call Name —</option>
              {ESTIMATOR_UI_CALL_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </td>

      <td>
        <span className="print-only">{line.qty}</span>
        <input
          className="no-print labour-qty-input"
          type="number"
          onFocus={(e) => e.currentTarget.select()}
          inputMode="numeric"
          min={1}
          max={999}
          value={line.qty}
          onChange={(e) => updateLabour(line.id, { qty: Number(e.target.value) })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              focusNext(e.currentTarget);
            }
          }}
        />
      </td>

      <td>
        <span className="print-only">
          {(() => {
            const d = new Date(line.shiftDate);
            return Number.isNaN(d.getTime()) ? line.shiftDate : formatDateDDMMYYYY(d);
          })()}
        </span>

       <input
  className={`no-print labour-field labour-date-input${shiftDateInvalid ? " field-error" : ""}`}
  type="date"
  value={line.shiftDate || ""}
  onChange={(e) => {
    updateLabour(line.id, { shiftDate: e.target.value });
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNext(e.currentTarget);
    }
  }}
/>
      </td>

      <td>
        <span className="print-only">
          {normaliseHHMM(line.startTime) ?? line.startTime}
        </span>

        {(() => {


          function commitStartTime() {
            const raw = startTimeText[line.id] ?? line.startTime;
            const normalized = parseStartTime(raw);

            if (normalized) {
              updateLabour(line.id, { startTime: normalized });

              setStartTimeText((prev) => {
                const next = { ...prev };
                delete next[line.id];
                return next;
              });
            } else {
              setStartTimeText((prev) => ({
                ...prev,
                [line.id]: raw,
              }));
            }
          }

          const startTimeDraft = startTimeText[line.id];
          const startTimeInvalid =
            typeof startTimeDraft === "string" &&
            startTimeDraft.trim() !== "" &&
            parseStartTime(startTimeDraft) === null;

          return (
            <input
              className={`no-print labour-time-input${startTimeInvalid ? " field-error" : ""}`}
              type="text"
              inputMode="text"
              placeholder="HH:MM"
              value={startTimeText[line.id] ?? line.startTime}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setStartTimeText((prev) => ({ ...prev, [line.id]: e.target.value }));
              }}
              onBlur={commitStartTime}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();

                  const raw = startTimeText[line.id] ?? line.startTime;
                  const normalized = parseStartTime(raw);

                  commitStartTime();

                  if (normalized) {
                    focusNext(e.currentTarget);
                  }
                }
              }}
            />
          );
        })()}
      </td>

      <td>
        <span className="print-only">{hoursToHHMM(line.durationHours)}</span>

       {(() => {
  function commitDuration() {
    const raw = (durationText[line.id] ?? hoursToHHMM(line.durationHours)).trim();
    const parsed = parseDurationHours(raw);

    const isAllowedDuration =
      parsed !== null && (isAdmin || parsed >= minBillableHours);

    if (isAllowedDuration) {
      updateLabour(line.id, { durationHours: parsed });

      setDurationText((prev) => {
        const next = { ...prev };
        delete next[line.id];
        return next;
      });
    } else {
      setDurationText((prev) => ({
        ...prev,
        [line.id]: raw,
      }));
    }
  }

          return (
            <input
              className={`no-print labour-field labour-time-input${durationDraftInvalid ? " field-error" : ""}`}
              type="text"
              inputMode="numeric"
              placeholder="HH:MM"
              value={durationText[line.id] ?? hoursToHHMM(line.durationHours)}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) =>
                setDurationText((prev) => ({
                  ...prev,
                  [line.id]: e.target.value,
                }))
              }
              onBlur={commitDuration}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();

                  const raw = durationText[line.id] ?? hoursToHHMM(line.durationHours);
                  const parsed = parseDurationHours(raw);

                  commitDuration();

                  if (parsed !== null && parsed >= minBillableHours) {
                    if (isLastRow) {
                      addLabour();

                      requestAnimationFrame(() => {
                        const callNameFields = Array.from(
                          document.querySelectorAll<HTMLElement>('[data-col="callName"]')
                        ).filter((el) => el.offsetParent !== null);

                        const lastCallNameField = callNameFields[callNameFields.length - 1];
                        lastCallNameField?.focus();
                      });
                    } else {
                      focusNext(e.currentTarget);
                    }
                  }
                }
              }}
            />
          );
        })()}
      </td>

      <td className="text-right">
  {resultLine && !rowInvalid ? (
    money(resultLine.costExGst)
  ) : (
    <span className="muted">—</span>
  )}
</td>

<td className="text-right">
  {resultLine && !rowInvalid ? (
    money(resultLine.totalIncGst)
  ) : (
    <span className="muted">—</span>
  )}
</td>

      <td className="no-print">
        <div className="labour-row-actions">
         <button
      type="button"
      className={`icon-btn labour-notes-toggle${showNotes ? " is-active" : ""}`}
      onClick={() => {
        if (showNotes && !line.notes?.trim()) {
          // Expanded but empty → collapse
          setNotesExpanded(false);
        } else if (!showNotes) {
          // Collapsed → expand and focus
          setNotesExpanded(true);
          requestAnimationFrame(() => {
            const ta = document.querySelector<HTMLTextAreaElement>(
              `textarea[data-notes-for="${line.id}"]`
            );
            ta?.focus();
          });
        } else {
          // Has content → focus the textarea
          const ta = document.querySelector<HTMLTextAreaElement>(
            `textarea[data-notes-for="${line.id}"]`
          );
          ta?.focus();
        }
      }}
      title={showNotes ? "Edit note" : "Add note"}
      aria-label={showNotes ? "Edit note" : "Add note"}
    >
      {showNotes ? (
        /* Filled note icon when content present or expanded */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
                stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15"/>
          <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        /* Plus icon when collapsed */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      )}
    </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => duplicateLabour(line.id)}
            title="Copy line"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.6" />
            </svg>
          </button>

          <button
            type="button"
            className="icon-btn danger"
            onClick={() => removeLabour(line.id)}
            title="Remove line"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 7h12" stroke="currentColor" strokeWidth="2.4" />
              <path d="M9 7v12" stroke="currentColor" strokeWidth="2.4" />
              <path d="M15 7v12" stroke="currentColor" strokeWidth="2.4" />
              <path d="M10 4h4" stroke="currentColor" strokeWidth="2.4" />
              <path d="M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </button>
        </div>
      </td>
    </tr>

    {/* Row 2: Notes only (screen only). The SmartStaff Call Name has moved
        into the primary row in place of the (now hidden) Role field. */}
         {showNotes && ( 
    <tr className="no-print">
      <td colSpan={9} style={{ paddingTop: 0, paddingBottom: 8 }}>
        <textarea
          className="labour-notes-input"
          data-notes-for={line.id} 
          onFocus={(e) => e.currentTarget.select()}
           onBlur={() => {
          // Collapse if user typed nothing and then clicked away
          if (!line.notes?.trim()) setNotesExpanded(false);
        }}
          placeholder="Notes (optional)"
          maxLength={300}
          rows={2}
          style={{ width: "100%" }}
          value={line.notes || ""}
          onChange={(e) => updateLabour(line.id, { notes: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              focusNext(e.currentTarget);
            }
          }}
        />
      </td>
    </tr>
         )}
    </>
  );
}
