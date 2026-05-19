"use client";

import Section from "./Section";
import Field from "./Field";
import styles from "../request-estimate.module.css";
import type { PublicEstimateRequest, FieldErrors } from "../lib/types";

type YourDetailsSectionProps = {
  request: PublicEstimateRequest;
  errors: FieldErrors;
  onChange: <K extends keyof PublicEstimateRequest>(
    field: K,
    value: PublicEstimateRequest[K]
  ) => void;
};

export default function YourDetailsSection({
  request,
  errors,
  onChange,
}: YourDetailsSectionProps) {
  return (
    <Section
      number="01"
      title="Your details"
      description="So we know who to send the estimate to."
    >
      <div className={styles.fieldGrid}>
        <Field label="Company name" required error={errors.companyName}>
          <input
            type="text"
            value={request.companyName}
            onChange={(e) => onChange("companyName", e.target.value)}
            placeholder="e.g. Acme Productions"
          />
        </Field>

        <Field label="Contact name" required error={errors.customerName}>
          <input
            type="text"
            value={request.customerName}
            onChange={(e) => onChange("customerName", e.target.value)}
            placeholder="Your full name"
          />
        </Field>

        <Field
          label="Email"
          required
          error={errors.email}
          help="We'll send your verification code here."
        >
          <input
            type="email"
            value={request.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="name@company.com"
          />
        </Field>

        <Field label="Phone" required error={errors.phone}>
          <input
            type="tel"
            value={request.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="0400 000 000"
          />
        </Field>
      </div>
    </Section>
  );
}
