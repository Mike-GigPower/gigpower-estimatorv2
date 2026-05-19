"use client";

import styles from "../request-estimate.module.css";

type SubmitBarProps = {
  needsCrewAdvice: boolean;
  busy: boolean;
};

export default function SubmitBar({ needsCrewAdvice, busy }: SubmitBarProps) {
  const label = busy
    ? "Sending code..."
    : needsCrewAdvice
    ? "Request a call →"
    : "Get my estimate →";

  return (
    <div className={styles.submitBar}>
      <div className={styles.submitNote}>
        Next: we&apos;ll send a <strong>verification code</strong> to your email.
        Your form details are saved while you verify.
      </div>
      <button type="submit" className={styles.btnPrimary} disabled={busy}>
        {label}
      </button>
    </div>
  );
}
