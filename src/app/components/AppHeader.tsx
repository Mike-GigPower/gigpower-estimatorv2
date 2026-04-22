import Image from "next/image";
import { defaultConfig } from "@/src/lib/config";

type AppHeaderProps = {
  draftName: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  version?: number;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  venue?: string;
};

export default function AppHeader({
  draftName,
  quoteNumber,
  quoteDate,
  validUntil,
  version,
  companyName,
  contactName,
  contactEmail,
  contactPhone,
  venue,
}: AppHeaderProps) {
  return (
    <>
      {/* Print-only header */}
      <div className="print-header print-only">
        <div className="print-header-top">
          <div className="print-title-row">
            <Image
              src="/brand/gigpower-mark.png"
              alt="GigPower"
              width={44}
              height={44}
              priority
            />
            <h1 style={{ margin: 0 }}>GigPower Estimate</h1>
          </div>

          <div className="print-abn-block">
  			<div className="print-company-name">Gig Power Pty Ltd</div>
  			<div className="print-abn">ABN 92 052 306 706</div>
		  </div>
        </div>

        

        <div className="quote-meta">
  {draftName && (
    <div>
      <strong>Event:</strong> {draftName}
    </div>
  )}
  <div>
    <strong>Quote #:</strong> {quoteNumber || "—"} · Version {version ?? 1}
  </div>
  <div>
    <strong>Date:</strong> {quoteDate || "—"}
  </div>
  <div>
    <strong>Valid Until:</strong> {validUntil || "—"}
  </div>
</div>
      </div>

      
      {/* Screen header */}
<div className="gp-header no-print">
  <div className="gp-brand">
    <Image
      src="/brand/gigpower-mark.png"
      alt="GigPower"
      width={44}
      height={44}
      priority
    />
    <div className="gp-brand-text">
      <h1 className="gp-title">Quote Estimator</h1>
      <div className="gp-tagline">The entertainment labour specialists</div>
      <small className="gp-subnote">
        Day starts {defaultConfig.dayStart}, Night starts {defaultConfig.nightStart}. Min billable per line: {defaultConfig.minBillableHours}h.
      </small>
    </div>
  </div>
</div>

      {/* Print-only customer details */}
      <div className="print-header-details print-only">
        {companyName && (
          <div>
            <strong>Company:</strong> {companyName}
          </div>
        )}
        {contactName && (
          <div>
            <strong>Contact:</strong> {contactName}
          </div>
        )}
        {contactEmail && (
          <div>
            <strong>Email:</strong> {contactEmail}
          </div>
        )}
        {contactPhone && (
          <div>
            <strong>Phone:</strong> {contactPhone}
          </div>
        )}
        {venue && (
          <div>
            <strong>Venue:</strong> {venue}
          </div>
        )}
      </div>
    </>
  );
}