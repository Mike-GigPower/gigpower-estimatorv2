import type { QuoteInput, QuoteRateCard } from "@/src/lib/types";

type ClientDetailsCardProps = {
  input: QuoteInput;
  onUpdateHeader: (
    patch: Partial<
      Pick<
        QuoteInput,
        | "companyName"
        | "contactName"
        | "contactEmail"
        | "contactPhone"
        | "venue"
        | "notes"
        | "eventName"
        | "eventDate"
        | "onsiteContact"
        | "onsiteContactPhone"
      >
    >
  ) => void;
  // Booking answers that choose the rate card. The parent re-derives line
  // roles under the new card.
  onUpdateRateCard: (next: QuoteRateCard) => void;
  // Inline validation messages keyed by field (companyName, contactName,
  // contactEmail, venue, australianOpen). Absent/empty = no error for that field.
  errors?: Record<string, string>;
};

export default function ClientDetailsCard({
  input,
  onUpdateHeader,
  onUpdateRateCard,
  errors = {},
}: ClientDetailsCardProps) {
  const mopt = input.rateCard?.mopt === true;
  const australianOpen = input.rateCard?.australianOpen ?? null;
  // Shown as soon as MOPT is ticked, not only after a save attempt: until it's
  // answered the quote has no card, so nothing is priced.
  const australianOpenError =
    errors.australianOpen ||
    (mopt && australianOpen === null ? "Answer Australian Open." : "");

  return (
  <div className="card no-print" style={{ display: "grid", gap: 16 }}>
    
    {/* Header */}
    <div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
  Client Details
</h3>
      <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
        Enter client and contact information for this estimate. Fields marked
        with <span className="required-star" aria-hidden="true">*</span> are
        required before the estimate can be saved.
      </p>
    </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="col">
          <label>
            Company name
            <span className="required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="field-companyName"
            className={errors.companyName ? "field-error" : undefined}
            value={input.companyName}
            onChange={(e) => onUpdateHeader({ companyName: e.target.value })}
            placeholder="Client company"
            aria-required="true"
            aria-invalid={errors.companyName ? true : undefined}
          />
          {errors.companyName && (
            <small className="field-error-text">{errors.companyName}</small>
          )}
        </div>

        <div className="col">
          <label>
            Contact name
            <span className="required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="field-contactName"
            className={errors.contactName ? "field-error" : undefined}
            value={input.contactName}
            onChange={(e) => onUpdateHeader({ contactName: e.target.value })}
            placeholder="Contact person"
            aria-required="true"
            aria-invalid={errors.contactName ? true : undefined}
          />
          {errors.contactName && (
            <small className="field-error-text">{errors.contactName}</small>
          )}
        </div>

        <div className="col">
          <label>
            Contact email
            <span className="required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="field-contactEmail"
            className={errors.contactEmail ? "field-error" : undefined}
            value={input.contactEmail}
            onChange={(e) => onUpdateHeader({ contactEmail: e.target.value })}
            placeholder="name@company.com"
            aria-required="true"
            aria-invalid={errors.contactEmail ? true : undefined}
          />
          {errors.contactEmail && (
            <small className="field-error-text">{errors.contactEmail}</small>
          )}
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
          <label>
            Venue
            <span className="required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="field-venue"
            className={errors.venue ? "field-error" : undefined}
            value={input.venue ?? ""}
            onChange={(e) => onUpdateHeader({ venue: e.target.value })}
            placeholder="Event venue"
            aria-required="true"
            aria-invalid={errors.venue ? true : undefined}
          />
          {errors.venue && (
            <small className="field-error-text">{errors.venue}</small>
          )}
        </div>

        <div className="col">
          <label>
            Onsite contact{" "}
            <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              (CrewFinder)
            </span>
          </label>
          <input
            value={input.onsiteContact ?? ""}
            onChange={(e) => onUpdateHeader({ onsiteContact: e.target.value })}
            placeholder="Name of onsite contact"
          />
        </div>

        <div className="col">
          <label>
            Onsite contact phone{" "}
            <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              (CrewFinder)
            </span>
          </label>
          <input
            value={input.onsiteContactPhone ?? ""}
            onChange={(e) => onUpdateHeader({ onsiteContactPhone: e.target.value })}
            placeholder="0400 000 000"
          />
        </div>
      </div>

      <div
        className="row"
        style={{ marginTop: 8, alignItems: "flex-start" }}
      >
        <div className="col">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="field-mopt"
              type="checkbox"
              style={{ width: "auto" }}
              checked={mopt}
              onChange={(e) =>
                onUpdateRateCard({ mopt: e.target.checked, australianOpen: null })
              }
            />
            MOPT booking
          </label>
        </div>

        {mopt && (
          <div className="col">
            <fieldset
              id="field-australianOpen"
              className={australianOpenError ? "field-error" : undefined}
              aria-required="true"
              aria-invalid={australianOpenError ? true : undefined}
              style={{ border: "none", padding: 0, margin: 0 }}
            >
              <legend style={{ padding: 0 }}>
                Australian Open
                <span className="required-star" aria-hidden="true">*</span>
              </legend>
              <div style={{ display: "flex", gap: 16 }}>
                {([true, false] as const).map((value) => (
                  <label
                    key={String(value)}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="radio"
                      name="australianOpen"
                      style={{ width: "auto" }}
                      checked={australianOpen === value}
                      onChange={() =>
                        onUpdateRateCard({ mopt: true, australianOpen: value })
                      }
                    />
                    {value ? "Yes" : "No"}
                  </label>
                ))}
              </div>
            </fieldset>
            {australianOpenError && (
              <small className="field-error-text">{australianOpenError}</small>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <label>
          Notes{" "}
          <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            (also sent as operational notes to CrewFinder)
          </span>
        </label>
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