"use client";

import Image from "next/image";
import styles from "../request-estimate.module.css";

type VerifyEmailScreenProps = {
  email: string;
  code: string;
  error: string;
  busy: boolean;
  resendCooldown: number;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  onBack: () => void;
  onResend: () => void;
};

export default function VerifyEmailScreen({
  email,
  code,
  error,
  busy,
  resendCooldown,
  onCodeChange,
  onVerify,
  onBack,
  onResend,
}: VerifyEmailScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.verifyCard}>
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

        <h1 className={styles.verifyTitle}>Verify your email</h1>
        <p className={styles.verifySub}>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to
          complete your request. Your form details are saved.
        </p>

        <div className={styles.field}>
          <label>Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) =>
              onCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onVerify();
              }
            }}
            placeholder="123456"
            maxLength={6}
            className={styles.codeInput}
            autoFocus
          />
          {error && <span className={styles.fieldError}>{error}</span>}
        </div>

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onVerify}
          disabled={busy || code.length !== 6}
          style={{ width: "100%", marginTop: 16 }}
        >
          {busy ? "Verifying..." : "Confirm & submit"}
        </button>

        <div className={styles.verifyActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onBack}
            disabled={busy}
          >
            Back to form
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onResend}
            disabled={busy || resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend code (${resendCooldown}s)`
              : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}
