import type { QuoteInput } from "@/src/lib/types";

type ClientDetailsCardProps = {
  input: QuoteInput;
  onUpdateHeader: (
    patch: Partial<
      Pick<
        QuoteInput,
        "companyName" | "contactName" | "contactEmail" | "contactPhone" | "venue" | "notes"
      >
    >
  ) => void;
};

export default function ClientDetailsCard({
  input,
  onUpdateHeader,
}: ClientDetailsCardProps) {
  return (
    <div className="card no-print">
      <div className="row">
        <div className="col">
          <label>Company name</label>
          <input
            value={input.companyName}
            onChange={(e) => onUpdateHeader({ companyName: e.target.value })}
            placeholder="Client company"
          />
        </div>

        <div className="col">
          <label>Contact name</label>
          <input
            value={input.contactName}
            onChange={(e) => onUpdateHeader({ contactName: e.target.value })}
            placeholder="Contact person"
          />
        </div>

        <div className="col">
          <label>Contact email</label>
          <input
            value={input.contactEmail}
            onChange={(e) => onUpdateHeader({ contactEmail: e.target.value })}
            placeholder="name@company.com"
          />
        </div>

        <div className="col">
          <label>Contact phone</label>
          <input
            value={input.contactPhone}
            onChange={(e) => onUpdateHeader({ contactPhone: e.target.value })}
            placeholder="0400 000 000"
          />
        </div>

        <div className="col">
          <label>Venue</label>
          <input
            value={input.venue ?? ""}
            onChange={(e) => onUpdateHeader({ venue: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Notes</label>
        <textarea
          value={input.notes ?? ""}
          onChange={(e) => onUpdateHeader({ notes: e.target.value })}
          placeholder="Optional quote notes"
          rows={3}
        />
      </div>
    </div>
  );
}