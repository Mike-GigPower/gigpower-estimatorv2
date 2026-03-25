import React from "react";
import NonLabourRow from "./NonLabourRow";

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

type NonLabourResult = {
  nonLabourLines: NonLabourResultLine[];
};

type NonLabourTableProps = {
  nonLabour: NonLabourLine[];
  result?: NonLabourResult | null;
  hasNonLabourData: boolean;
  addNonLabour: () => void;
  updateNonLabour: (id: string, patch: Partial<NonLabourLine>) => void;
  removeNonLabour: (id: string) => void;
  money: (value: number) => string;
  gstRate: number;
};

export default function NonLabourTable({
  nonLabour,
  result,
  hasNonLabourData,
  addNonLabour,
  updateNonLabour,
  removeNonLabour,
  money,
  gstRate,
}: NonLabourTableProps) {
  const nonLabourResultById = Object.fromEntries(
    (result?.nonLabourLines ?? []).map((line) => [line.id, line])
  );

  return (
    <div className={`card ${!hasNonLabourData ? "print-hide" : ""}`}>
      <div className="row non-labour-header-row">
        <h2 style={{ margin: 0, fontSize: 16 }}>Non-labour items</h2>
        <div className="no-print">
          <button type="button" onClick={addNonLabour}>
            + Add item
          </button>
        </div>
      </div>

      <div className="non-labour-table-wrap">
        <table className="entry-table non-labour-table">
          <thead>
  <tr>
    <th className="non-labour-col-description">Description</th>
    <th className="center non-labour-col-qty">Qty</th>
    <th className="numeric non-labour-col-unit">Unit (ex GST)</th>
    <th className="numeric non-labour-col-line">Line (ex GST)</th>
    <th className="numeric non-labour-col-total">Total (inc GST)</th>
    <th className="no-print non-labour-col-actions"></th>
  </tr>
</thead>

          <tbody>
            {nonLabour.map((line) => (
              <NonLabourRow
                key={line.id}
                line={line}
                resultLine={nonLabourResultById[line.id]}
                updateNonLabour={updateNonLabour}
                removeNonLabour={removeNonLabour}
                money={money}
                gstRate={gstRate}
              />
            ))}
          </tbody>
        </table>
      </div>

      <small className="muted no-print">
        Blank rows are hidden on the printed quote, but always editable on screen.
      </small>
    </div>
  );
}