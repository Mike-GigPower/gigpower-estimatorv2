import React from "react";

type TermsConditionsBoxProps = {
  title?: string;
  body: string;
  className?: string;
};

export default function TermsConditionsBox({
  title = "Terms & Conditions",
  body,
  className = "tcs-box print-only",
}: TermsConditionsBoxProps) {
  return (
    <div className={className}>
      <div className="tcs-title">{title}</div>
      <div className="tcs-body">{body}</div>
    </div>
  );
}