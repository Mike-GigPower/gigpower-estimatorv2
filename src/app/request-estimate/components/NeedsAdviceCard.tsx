"use client";

import styles from "../request-estimate.module.css";

type NeedsAdviceCardProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function NeedsAdviceCard({
  checked,
  onChange,
}: NeedsAdviceCardProps) {
  return (
    <label className={styles.adviceCard}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className={styles.adviceCardTitle}>
          Not sure what crew you need?
        </span>
        <span className={styles.adviceCardDesc}>
          Tick this and skip the crew section — a GigPower rep will call you to
          work it out together.
        </span>
      </span>
    </label>
  );
}
