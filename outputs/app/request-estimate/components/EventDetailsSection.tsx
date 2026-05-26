"use client";

import Section from "./Section";
import Field from "./Field";
import styles from "../request-estimate.module.css";
import type { PublicEstimateRequest, FieldErrors } from "../lib/types";

type EventDetailsSectionProps = {
  request: PublicEstimateRequest;
  errors: FieldErrors;
  onChange: <K extends keyof PublicEstimateRequest>(
    field: K,
    value: PublicEstimateRequest[K]
  ) => void;
};

export default function EventDetailsSection({
  request,
  errors,
  onChange,
}: EventDetailsSectionProps) {
  return (
    <Section
      number="02"
      title="Event details"
      description="The basics about your event or production."
    >
      <div className={styles.fieldGrid}>
        <Field label="Event name" required error={errors.eventName} spanFull>
          <input
            type="text"
            value={request.eventName}
            onChange={(e) => onChange("eventName", e.target.value)}
            placeholder="e.g. Annual Gala 2026"
          />
        </Field>

        <Field label="Start date" required error={errors.eventDate}>
          <input
            type="date"
            value={request.eventDate}
            onChange={(e) => onChange("eventDate", e.target.value)}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              if (input.showPicker) input.showPicker();
            }}
            style={{ cursor: "pointer" }}
          />
        </Field>

        <Field label="Venue" required error={errors.eventLocation}>
          <input
            type="text"
            value={request.eventLocation}
            onChange={(e) => onChange("eventLocation", e.target.value)}
            placeholder="Venue or site address"
          />
        </Field>
      </div>
    </Section>
  );
}
