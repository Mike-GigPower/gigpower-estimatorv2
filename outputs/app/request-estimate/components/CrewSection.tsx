"use client";

import Section from "./Section";
import CrewLineCard from "./CrewLineCard";
import styles from "../request-estimate.module.css";
import type { PublicCrewLine, FieldErrors } from "../lib/types";

type CrewSectionProps = {
  crewLines: PublicCrewLine[];
  errors: FieldErrors;
  onChangeLine: (id: string, patch: Partial<PublicCrewLine>) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onDurationBlur: (id: string, value: string) => void;
};

export default function CrewSection({
  crewLines,
  errors,
  onChangeLine,
  onAdd,
  onDuplicate,
  onRemove,
  onDurationBlur,
}: CrewSectionProps) {
  return (
    <Section
      number="03"
      title="Crew you need"
      description="Add a row for each call. If you need the same crew across multiple days, use 'Duplicate' to copy a row."
      meta="One row per crew type and shift"
    >
      <div>
        {crewLines.map((line, i) => (
          <CrewLineCard
            key={line.id}
            line={line}
            index={i}
            errors={errors}
            canRemove={crewLines.length > 1}
            onChange={onChangeLine}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            onDurationBlur={onDurationBlur}
          />
        ))}
      </div>

      <button type="button" className={styles.addCrew} onClick={onAdd}>
        + Add another crew row
      </button>
    </Section>
  );
}
