import React from "react";

import { calculateNonLabourLine } from "@/src/lib/estimator/calc";

type NonLabourLine = {
  id: string;
  description: string;
  qty: number;
  amountExGst: number;
};

type NonLabourResultLine = {
  id: string;
  lineAmountExGst: number;
  totalIncGst: number;
};

type NonLabourRowProps = {
  line: NonLabourLine;
  resultLine?: NonLabourResultLine;
  updateNonLabour: (id: string, patch: Partial<NonLabourLine>) => void;
  removeNonLabour: (id: string) => void;
  money: (value: number) => string;
  gstRate: number;
};

export default function NonLabourRow({
  line,
  resultLine,
  updateNonLabour,
  removeNonLabour,
  money,
  gstRate,
}: NonLabourRowProps) {
  const blank =
    (line.description || "").trim() === "" &&
    line.amountExGst === 0 &&
    line.qty === 1;

  const lineTotalExGst = calculateNonLabourLine(
  line.qty,
  line.amountExGst
);

  return (
    <tr data-blank={blank ? "true" : "false"}>
      <td>
        <span className="print-only">{line.description?.trim() || "—"}</span>
        <input
          className="no-print"
          value={line.description}
          onChange={(e) =>
            updateNonLabour(line.id, { description: e.target.value })
          }
          placeholder="e.g., Truck hire, Harness hire"
        />
      </td>

      <td className="center">
        <span className="print-only">{line.qty || 0}</span>
        <input
          className="no-print non-labour-qty-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step="1"
          value={line.qty}
          onChange={(e) =>
            updateNonLabour(line.id, { qty: Number(e.target.value) })
          }
        />
      </td>

      <td className="numeric">
        <span className="print-only">{money(line.amountExGst)}</span>
        <input
  			className="no-print non-labour-unit-input"
  			type="number"
  			step="0.01"
  			value={line.amountExGst}
  			onChange={(e) =>
    			updateNonLabour(line.id, { amountExGst: Number(e.target.value) })
  			}
		/>
      </td>

      <td className="numeric">
        {money(resultLine ? resultLine.lineAmountExGst : lineTotalExGst)}
      </td>

      <td className="numeric">
        {money(
          resultLine
            ? resultLine.totalIncGst
            : lineTotalExGst * (1 + gstRate)
        )}
      </td>

      <td className="no-print">
        <div>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => removeNonLabour(line.id)}
            title="Remove item"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 7h12" stroke="currentColor" strokeWidth="2.4" />
              <path d="M9 7v12" stroke="currentColor" strokeWidth="2.4" />
              <path d="M15 7v12" stroke="currentColor" strokeWidth="2.4" />
              <path d="M10 4h4" stroke="currentColor" strokeWidth="2.4" />
              <path d="M7 7l1 13h8l1-13" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}