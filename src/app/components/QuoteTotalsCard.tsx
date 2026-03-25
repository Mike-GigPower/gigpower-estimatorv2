import React from "react";

type QuoteTotals = {
  labourExGst: number;
  nonLabourExGst: number;
  gst: number;
  grandTotalIncGst: number;
};

type QuoteTotalsCardProps = {
  totals?: QuoteTotals | null;
  money: (value: number) => string;
};

export default function QuoteTotalsCard({
  totals,
  money,
}: QuoteTotalsCardProps) {
  if (!totals) {
    return (
      <div className="card">
        <h2 style={{ margin: 0, fontSize: 16 }}>Totals</h2>
        <div className="totals">
          <div><strong>Labour (ex GST):</strong> {money(0)}</div>
          <div><strong>Non-labour (ex GST):</strong> {money(0)}</div>
          <div><strong>GST:</strong> {money(0)}</div>
          <div className="grand">
            <strong>Grand Total (inc GST):</strong> {money(0)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ margin: 0, fontSize: 16 }}>Totals</h2>

      <div className="totals-grid">
  <div className="totals-row">
    <div className="totals-label"><strong>Labour (ex GST):</strong></div>
    <div className="totals-value">{money(totals?.labourExGst ?? 0)}</div>
  </div>

  <div className="totals-row">
    <div className="totals-label"><strong>Non-labour (ex GST):</strong></div>
    <div className="totals-value">{money(totals?.nonLabourExGst ?? 0)}</div>
  </div>

  <div className="totals-row">
    <div className="totals-label"><strong>GST:</strong></div>
    <div className="totals-value">{money(totals?.gst ?? 0)}</div>
  </div>

  <div className="totals-row totals-grand">
    <div className="totals-label">
      <strong>Grand Total (inc GST):</strong>
    </div>
    <div className="totals-value">
      {money(totals?.grandTotalIncGst ?? 0)}
    </div>
  </div>
</div>

      <div style={{ marginTop: 10 }}>
        <small className="muted no-print">
          Rates, roles, pulic holidays and T&Cs can be updated via the Admin console.
        </small>
      </div>
    </div>
  );
}