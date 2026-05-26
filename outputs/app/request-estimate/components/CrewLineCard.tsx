"use client";

import { useAppConfig } from "@/src/lib/useAppConfig";
import { parseStartTime } from "@/src/lib/estimator/calc";
import Field from "./Field";
import CallNameSelect from "./CallNameSelect";
import styles from "../request-estimate.module.css";
import type { PublicCrewLine, FieldErrors } from "../lib/types";

type CrewLineCardProps = {
  line: PublicCrewLine;
  index: number;
  errors: FieldErrors;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<PublicCrewLine>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  /**
   * Called when a duration field loses focus. The parent owns the error
   * state for duration validation since it depends on `config.minBillableHours`.
   */
  onDurationBlur: (id: string, value: string) => void;
};

/**
 * Builds the error key for a given crew line field, matching what the
 * parent page produces (e.g. "crew_<id>_duration").
 */
function errKey(lineId: string, field: keyof PublicCrewLine | "duration"): string {
  return `crew_${lineId}_${field}`;
}

export default function CrewLineCard({
  line,
  index,
  errors,
  canRemove,
  onChange,
  onDuplicate,
  onRemove,
  onDurationBlur,
}: CrewLineCardProps) {
  const { config } = useAppConfig();

  return (
    <div className={styles.crewLine}>
      <div className={styles.crewLineHeader}>
        <span className={styles.crewLineNum}>Row {index + 1}</span>
        <div className={styles.crewLineActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onDuplicate(line.id)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={() => onRemove(line.id)}
            disabled={!canRemove}
          >
            Remove
          </button>
        </div>
      </div>

      <div className={styles.crewGrid}>
        <Field
          label="Role"
          required
          error={errors[errKey(line.id, "crewType")]}
          className={styles.crewCall}
        >
          <CallNameSelect
            value={line.crewType}
            onChange={(value) => onChange(line.id, { crewType: value })}
            required
          />
        </Field>

        <Field label="Qty" required error={errors[errKey(line.id, "qty")]}>
          <input
            type="number"
            min="1"
            value={line.qty}
            onChange={(e) => onChange(line.id, { qty: e.target.value })}
          />
        </Field>

        <Field
          label="Shift date"
          required
          error={errors[errKey(line.id, "shiftDate")]}
        >
          <input
            type="date"
            value={line.shiftDate}
            onChange={(e) => onChange(line.id, { shiftDate: e.target.value })}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              if (input.showPicker) input.showPicker();
            }}
            style={{ cursor: "pointer" }}
          />
        </Field>

        <Field
          label="Start time"
          required
          error={errors[errKey(line.id, "startTime")]}
        >
          <input
            type="text"
            value={line.startTime}
            onChange={(e) => onChange(line.id, { startTime: e.target.value })}
            onBlur={(e) => {
              const parsed = parseStartTime(e.target.value);
              if (parsed) onChange(line.id, { startTime: parsed });
            }}
            placeholder="e.g. 10:30pm or 22:30"
          />
        </Field>

        <Field
          label="Duration (hrs)"
          required
          error={errors[errKey(line.id, "duration")]}
          help={`Minimum ${config.minBillableHours} hours per shift.`}
        >
          <input
            type="text"
            value={line.duration}
            onChange={(e) => onChange(line.id, { duration: e.target.value })}
            onBlur={(e) => onDurationBlur(line.id, e.target.value)}
            placeholder={`${config.minBillableHours}:00`}
            inputMode="decimal"
          />
        </Field>

        <Field label="Shift notes" className={styles.crewNotes}>
          <input
            type="text"
            value={line.notes}
            onChange={(e) => onChange(line.id, { notes: e.target.value })}
            placeholder="Optional — e.g. lifting required, ticket needed"
          />
        </Field>
      </div>
    </div>
  );
}
