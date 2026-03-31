import React from "react";

type LabourLine = {
  id: string;
  role: string;
  qty: number;
  shiftDate: string;
  startTime: string;
  durationHours: number;
  notes?: string;
};

type LabourResultLine = {
  id: string;
  costExGst: number;
  totalIncGst: number;
};

type LabourRowProps = {
  line: LabourLine;
  resultLine?: LabourResultLine;
  roleOptions: string[];
  startTimeText: Record<string, string>;
  setStartTimeText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  durationText: Record<string, string>;
  setDurationText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateLabour: (id: string, patch: Partial<LabourLine>) => void;
  duplicateLabour: (id: string) => void;
  removeLabour: (id: string) => void;
  formatDateDDMMYYYY: (date: Date) => string;
  normaliseHHMM: (value: string) => string | null;
  hoursToHHMM: (hours: number) => string;
  autoColonHHMM: (value: string) => string;
  money: (value: number) => string;
};

export default function LabourRow({
  line,
  resultLine,
  roleOptions,
  startTimeText,
  setStartTimeText,
  durationText,
  setDurationText,
  updateLabour,
  duplicateLabour,
  removeLabour,
  formatDateDDMMYYYY,
  normaliseHHMM,
  hoursToHHMM,
  autoColonHHMM,
  money,
}: LabourRowProps) {
  return (
    <tr>
      <td>
  <div className="labour-role-cell">
    <span className="print-only">
      {line.role}
      {line.notes ? ` — ${line.notes}` : ""}
    </span>

    <select
      className="no-print labour-role-select"
      value={line.role}
      onChange={(e) => updateLabour(line.id, { role: e.target.value })}
    >
      {roleOptions.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>

    <textarea
  className="no-print labour-notes-input"
  placeholder="Notes (optional)"
  maxLength={100}
  rows={2}
  value={line.notes || ""}
  onChange={(e) => updateLabour(line.id, { notes: e.target.value })}
/>
  </div>
</td>

      <td>
        <span className="print-only">{line.qty}</span>
        <input
          className="no-print labour-qty-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={line.qty}
          onChange={(e) => updateLabour(line.id, { qty: Number(e.target.value) })}
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
    className="no-print labour-field labour-date-input"
    type="date"
    value={line.shiftDate || ""}
    onChange={(e) => {
      updateLabour(line.id, { shiftDate: e.target.value });
    }}
    onFocus={(e) => e.currentTarget.showPicker?.()}
  />
</td>

      <td>
        <span className="print-only">{normaliseHHMM(line.startTime) ?? line.startTime}</span>
        <input
          className="no-print labour-time-input"
          type="text"
          inputMode="numeric"
          placeholder="HH:MM"
          value={startTimeText[line.id] ?? line.startTime}
          onChange={(e) => {
            const v = autoColonHHMM(e.target.value);
            setStartTimeText((prev) => ({ ...prev, [line.id]: v }));
          }}
          onBlur={() => {
            const raw = startTimeText[line.id] ?? line.startTime;
            const normalized = normaliseHHMM(raw);

            if (normalized) {
              updateLabour(line.id, { startTime: normalized });
            }

            setStartTimeText((prev) => {
              const next = { ...prev };
              delete next[line.id];
              return next;
            });
          }}
        />
      </td>

      <td>
        <span className="print-only">{hoursToHHMM(line.durationHours)}</span>
        <input
          className="no-print labour-field labour-time-input"
          type="text"
          inputMode="numeric"
          placeholder="HH:MM"
          value={durationText[line.id] ?? hoursToHHMM(line.durationHours)}
          onChange={(e) =>
            setDurationText((prev) => ({ ...prev, [line.id]: e.target.value }))
          }
          onBlur={() => {
            const raw = (durationText[line.id] ?? hoursToHHMM(line.durationHours)).trim();
            const m = raw.match(/^(\d{1,2}):([0-5]\d)$/);

            if (m) {
              const h = Number(m[1]);
              const mins = Number(m[2]);
              const hours = h + mins / 60;

              if (hours > 0) {
                updateLabour(line.id, { durationHours: hours });
              }
            }

            setDurationText((prev) => {
              const next = { ...prev };
              delete next[line.id];
              return next;
            });
          }}
        />
      </td>

      <td className="text-right">
  		{resultLine ? money(resultLine.costExGst) : <span className="muted">—</span>}
	  </td>
	  <td className="text-right">
  		{resultLine ? money(resultLine.totalIncGst) : <span className="muted">—</span>}
	  </td>

      <td className="no-print">
  <div className="labour-row-actions">
    <button
      type="button"
      className="icon-btn"
      onClick={() => duplicateLabour(line.id)}
      title="Copy line"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect
          x="9"
          y="9"
          width="10"
          height="10"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="5"
          y="5"
          width="10"
          height="10"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.6"
        />
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
  );
}