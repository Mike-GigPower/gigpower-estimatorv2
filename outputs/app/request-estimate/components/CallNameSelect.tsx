"use client";

import { CALL_NAME_GROUPS } from "../lib/callNameOptions";

type CallNameSelectProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
};

export default function CallNameSelect({
  value,
  onChange,
  required,
  id,
}: CallNameSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="" disabled>
        — Select a role —
      </option>
      {CALL_NAME_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
