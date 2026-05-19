"use client";

import { ReactNode } from "react";
import styles from "../request-estimate.module.css";

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  spanFull?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Field wrapper — handles label, required-marker, error message and help text.
 *
 * Pass a unique error key from the parent to display inline validation errors
 * instead of using window.alert().
 */
export default function Field({
  label,
  required,
  error,
  help,
  spanFull,
  className,
  children,
}: FieldProps) {
  const classes = [
    styles.field,
    spanFull ? styles.span2 : "",
    error ? styles.hasError : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <label>
        {label}
        {required && <span className={styles.req}>*</span>}
      </label>
      {children}
      {help && !error && <span className={styles.fieldHelp}>{help}</span>}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}
