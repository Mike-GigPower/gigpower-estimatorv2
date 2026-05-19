"use client";

import Section from "./Section";
import Field from "./Field";

type NotesSectionProps = {
  value: string;
  required: boolean;
  error?: string;
  onChange: (value: string) => void;
};

export default function NotesSection({
  value,
  required,
  error,
  onChange,
}: NotesSectionProps) {
  return (
    <Section
      number="04"
      title="Anything else"
      description={
        required
          ? "Required — please share as much as you can so we can estimate accurately. Event type, expected schedule, venue access, bump in/out times, anything you're unsure about."
          : "Optional — load-in/out times, access constraints, certifications needed, anything we should know."
      }
    >
      <Field label="Notes" required={required} error={error}>
        <textarea
          value={value}
          rows={5}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            required
              ? "Please tell us as much as you can: event type, expected schedule, venue access, bump in/out times, number of stages/rooms..."
              : "e.g. Bump in from 6am via loading dock C. Forklift ticket required. Quiet operation until 10am due to neighbouring residential building..."
          }
        />
      </Field>
    </Section>
  );
}
