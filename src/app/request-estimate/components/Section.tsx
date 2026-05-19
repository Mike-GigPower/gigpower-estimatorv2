"use client";

import { ReactNode } from "react";
import styles from "../request-estimate.module.css";

type SectionProps = {
  number: string;
  title: string;
  description?: string;
  meta?: string;
  children: ReactNode;
};

export default function Section({
  number,
  title,
  description,
  meta,
  children,
}: SectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          {number} · {title}
        </h2>
        {meta && <span className={styles.sectionMeta}>{meta}</span>}
      </div>
      {description && <p className={styles.sectionDesc}>{description}</p>}
      {children}
    </div>
  );
}
