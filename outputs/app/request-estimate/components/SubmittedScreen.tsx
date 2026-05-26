"use client";

import Image from "next/image";
import styles from "../request-estimate.module.css";

type SubmittedScreenProps = {
  needsCrewAdvice: boolean;
  onSubmitAnother: () => void;
};

export default function SubmittedScreen({
  needsCrewAdvice,
  onSubmitAnother,
}: SubmittedScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.submittedCard}>
        <div style={{ marginBottom: 24 }}>
          <Image
            src="/brand/gigpower-logo.png"
            alt="GigPower"
            width={200}
            height={60}
            style={{ width: "auto", height: 50, objectFit: "contain" }}
            priority
          />
        </div>

        <h1>
          {needsCrewAdvice
            ? "Call request received"
            : "Estimate request received"}
        </h1>

        {needsCrewAdvice ? (
          <>
            <p>
              Thanks — your request has been received. A GigPower
              representative will contact you to discuss your event and crew
              requirements.
            </p>
            <p className={styles.submittedUrgent}>
              If your request is urgent, please call us on{" "}
              <strong>+61 3 9376 5600</strong>.
            </p>
          </>
        ) : (
          <>
            <p>
              Thanks — your estimate request has been received. Check your
              email for your reference number and the costed estimate, usually
              within one business day.
            </p>
            <p className={styles.submittedUrgent}>
              Can&apos;t find the email? Check your spam folder, or call us on{" "}
              <strong>+61 3 9376 5600</strong>.
            </p>
          </>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onSubmitAnother}
          >
            Submit another request
          </button>
        </div>
      </div>
    </div>
  );
}
