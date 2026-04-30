"use client";

import { useState } from "react";
import { useAppConfig } from "@/src/lib/useAppConfig";
import { parseStartTime } from "@/src/lib/estimator/calc";
import Image from "next/image";

type PublicCrewLine = {
  id: string;
  crewType: string;
  qty: string;
  shiftDate: string;
  startTime: string;
  duration: string;
  notes: string;
};

type PublicEstimateRequest = {
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  crewLines: PublicCrewLine[];
  notes: string;
  needsCrewAdvice: boolean;
};

const initialRequest: PublicEstimateRequest = {
  customerName: "",
  companyName: "",
  email: "",
  phone: "",
  eventName: "",
  eventLocation: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  needsCrewAdvice: false,
  notes: "",
  crewLines: [
  {
    id: crypto.randomUUID(),
    crewType: "Standard Crew",
    qty: "1",
    shiftDate: "",
    startTime: "",
    duration: "",
    notes: "",
  },
],
};





export default function RequestEstimatePage() {
  	const { config } = useAppConfig();
	const crewTypeOptions = config.rates.map((rate) => rate.role);
  	const [request, setRequest] = useState<PublicEstimateRequest>(initialRequest);
  	const [submitted, setSubmitted] = useState(false);

  function updateField<K extends keyof PublicEstimateRequest>(
  field: K,
  value: PublicEstimateRequest[K]
  ) {
  setRequest((current) => {
    if (field === "eventDate") {
      const newValue = value as string;

      return {
        ...current,
        eventDate: newValue,
        crewLines: current.crewLines.map((line) => ({
          ...line,
          shiftDate: line.shiftDate || newValue,
        })),
      };
    }

    return {
      ...current,
      [field]: value,
    };
  });
   }
  
  function updateCrewLine(
  id: string,
  patch: Partial<PublicCrewLine>
) {
  setRequest((current) => ({
    ...current,
    crewLines: current.crewLines.map((line) =>
      line.id === id ? { ...line, ...patch } : line
    ),
  }));
  }

function addCrewLine() {
  setRequest((current) => ({
    ...current,
    crewLines: [
      ...current.crewLines,
      {
        id: crypto.randomUUID(),
        crewType: "Standard Crew",
        qty: "1",
        shiftDate: current.eventDate || "",
        startTime: "",
        duration: "",
        notes: "",
      },
    ],
  }));
}

function duplicateCrewLine(id: string) {
  setRequest((current) => {
    const lineToDuplicate = current.crewLines.find((line) => line.id === id);

    if (!lineToDuplicate) return current;

    return {
      ...current,
      crewLines: [
        ...current.crewLines,
        {
          ...lineToDuplicate,
          id: crypto.randomUUID(),
        },
      ],
    };
  });
}

function removeCrewLine(id: string) {
  setRequest((current) => {
    if (current.crewLines.length <= 1) {
      return current;
    }

    return {
      ...current,
      crewLines: current.crewLines.filter((line) => line.id !== id),
    };
  });
}

  function validateCrewLines() {
  for (const line of request.crewLines) {
    if (
  !line.crewType.trim() ||
  !line.qty.trim() ||
  !line.shiftDate.trim() ||
  !line.startTime.trim() ||
  !line.duration.trim()
) {
  console.log("Invalid crew line:", line);
  return false;
}
  }
  return true;
}

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  
  if (!request.phone.trim()) {
    alert("Please enter a contact phone number.");
    return;
  }

  // Validate crew requirements
  if (!request.needsCrewAdvice && !validateCrewLines()) {
  alert("Please complete all crew requirement fields, or tick the option for GigPower to contact you to discuss crew requirements.");
  return;
}

  // Validate top-level required fields
  if (
    !request.customerName ||
    !request.email ||
    !request.phone ||
    !request.eventName ||
    !request.eventLocation ||
    !request.eventDate
  ) {
    alert("Please complete all required fields.");
    return;
  }
  
  if (!request.needsCrewAdvice && !validateCrewLines()) {
  alert(
    "Please complete all crew requirement fields, or tick the option for GigPower to contact you to discuss crew requirements."
  );
  return;
}

  const response = await fetch("/api/estimate-request", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
});

const data = await response.json();

if (!data.success) {
  alert("Something went wrong submitting the request. Please try again.");
  return;
}

setSubmitted(true);
}

  if (submitted) {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="card" style={{ padding: "28px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          <img
            src="/brand/gigpower-logo.png"
            alt="GigPower"
            style={{ height: 50 }}
          />
        </div>

        <h1>
          {request.needsCrewAdvice
            ? "Call request received"
            : "Estimate request received"}
        </h1>

        <p className="muted">
          {request.needsCrewAdvice
            ? "Thanks — your request has been received. A GigPower representative will contact you to discuss your event and crew requirements."
            : "Thanks — your estimate request has been received. Please check your email for your estimate reference and details."}
        </p>

        {request.needsCrewAdvice && (
          <p style={{ fontSize: 13, color: "#aaa", marginTop: 10 }}>
            If your request is urgent, please call us on +61 3 9376 5600.
          </p>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={() => {
              setRequest(initialRequest);
              setSubmitted(false);
            }}
          >
            Submit another request
          </button>
        </div>
      </div>
    </main>
  );
}

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="card">
      <div style={{ marginBottom: 20 }}>
  <Image
    src="/brand/gigpower-logo.png"
    alt="GigPower"
  width={300}
  height={100}
  style={{
    width: "auto",
    height: "60px",
    objectFit: "contain",
    display: "block"
  }}
  />
</div>
        <h1>Request an Estimate</h1>
        <p className="muted">
          Tell us about your event and the crew support you need and the calculator
           will send you a costed estimate. Note - This is an estimate only and final 
           pricing will be reviewed by the Gig Power team.
        </p>

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="card" style={{ marginBottom: 16 }}>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      gap: 12,
      alignItems: "end",
    }}
  >
    <label>
      Company name <span className="required-star">*</span>
      <input
        value={request.companyName}
        onChange={(e) => updateField("companyName", e.target.value)}
        placeholder="Client company"
        required
      />
    </label>

    <label>
      Contact name <span className="required-star">*</span>
      <input
        value={request.customerName}
        onChange={(e) => updateField("customerName", e.target.value)}
        placeholder="Contact person"
        required
      />
    </label>

    <label>
      Contact email <span className="required-star">*</span>
      <input
        type="email"
        value={request.email}
        onChange={(e) => updateField("email", e.target.value)}
        placeholder="name@company.com"
        required
      />
    </label>

    <label>
      Contact phone <span className="required-star">*</span>
      <input
        value={request.phone}
        onChange={(e) => updateField("phone", e.target.value)}
        placeholder="0400 000 000"
        required
      />
    </label>

    

    <label style={{ gridColumn: "span 2" }}>
      Event name <span className="required-star">*</span>
      <input
        value={request.eventName}
        onChange={(e) => updateField("eventName", e.target.value)}
        placeholder="Event name"
        required
      />
    </label>

    <label>
      Start date <span className="required-star">*</span>
      <input
  type="date"
  value={request.eventDate}
  onChange={(e) => updateField("eventDate", e.target.value)}
  onClick={(e) => {
    const input = e.currentTarget as HTMLInputElement;
    if (input.showPicker) {
      input.showPicker();
    }
  }}
  style={{ cursor: "pointer" }}
/>
    </label>
    <label>
      Venue <span className="required-star">*</span>
      <input
        value={request.eventLocation}
        onChange={(e) => updateField("eventLocation", e.target.value)}
        placeholder="Venue / site"
        required
      />
    </label>

   
  </div>
</div>

          <div
  
  style={{
    marginTop: 18,
    marginBottom: 22,
  }}
>
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
      color: request.needsCrewAdvice ? "#fcb900" : "#cbd5e1",
      fontWeight: request.needsCrewAdvice ? 700 : 500,
    }}
  >
    <input
      type="checkbox"
      checked={request.needsCrewAdvice}
      onChange={(e) => updateField("needsCrewAdvice", e.target.checked)}
      style={{
        transform: "scale(1.2)",
        margin: 0,
        width: 16,
        height: 16,
        flex: "0 0 auto",
      }}
    />

    <span>
      I’m not sure what crew I need — please contact me to discuss.
    </span>
  </label>
</div>
  {!request.needsCrewAdvice && (
  <>
    <h2 style={{ fontSize: 18, marginTop: 8 }}>Crew requirements</h2>
    <p className="muted">
      Add one row per crew type and shift (e.g. different dates or start times).
    </p>

  {request.crewLines.map((line) => (
  <div key={line.id} className="card" style={{ marginBottom: 12 }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 90px 180px 160px 160px 1fr",
        gap: 12,
        alignItems: "end",
      }}
    >
      <label>
        Crew type <span className="required-star">*</span>
        <select
          value={line.crewType}
          onChange={(e) =>
            updateCrewLine(line.id, { crewType: e.target.value })
          }
        >
          {crewTypeOptions.map((role) => (
  <option key={role} value={role}>
    {role}
  </option>
))}
        </select>
      </label>

      <label>
        Qty <span className="required-star">*</span>
        <input
          type="number"
          min="1"
          value={line.qty}
          onChange={(e) =>
            updateCrewLine(line.id, { qty: e.target.value })
          }
        />
      </label>

      <label>
        Shift date <span className="required-star">*</span>
        <input
  type="date"
  value={line.shiftDate}
  onChange={(e) => updateCrewLine(line.id, "shiftDate", e.target.value)}
  onClick={(e) => {
    const input = e.currentTarget as HTMLInputElement;
    if (input.showPicker) {
      input.showPicker();
    }
  }}
  style={{ cursor: "pointer" }}
/>
      </label>

      <label>
        Start time <span className="required-star">*</span>
        <input
  value={line.startTime}
  onChange={(e) =>
    updateCrewLine(line.id, { startTime: e.target.value })
  }
  onBlur={(e) => {
    const parsed = parseStartTime(e.target.value);

    if (parsed) {
      updateCrewLine(line.id, { startTime: parsed });
    }
  }}
  placeholder="e.g. 10:30pm or 22:30"
/>
      </label>

      <label>
        Duration <span className="required-star">*</span>
        <input
          value={line.duration}
          onChange={(e) =>
            updateCrewLine(line.id, { duration: e.target.value })
          }
          placeholder="04:00 or 4.5"
        />
      </label>
      
      <div
  style={{
  gridColumn: "6 / 7",
    display: "flex",
    justifyContent: "flex-end", 
    gap: 8,
    alignItems: "end",
    width: "100%",
  }}
>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => duplicateCrewLine(line.id)}
        >
          Duplicate
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => removeCrewLine(line.id)}
          disabled={request.crewLines.length <= 1}
        >
          Remove
        </button>
      </div>

      <label style={{ gridColumn: "1 / 7" }}>
        Shift Notes
        <input
          value={line.notes}
          onChange={(e) =>
            updateCrewLine(line.id, { notes: e.target.value })
          }
        />
      </label>

      
    </div>
  </div>
))}

    <button type="button" onClick={addCrewLine}>
    + Add crew requirement
  </button>
  </>
)}


<label className="span-2">
            {request.needsCrewAdvice ? (
    <>
      Additional notes <span className="required-star">*</span>
    </>
  ) : (
    "Additional notes"
  )}
            <textarea
              value={request.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={5}
              placeholder={
  request.needsCrewAdvice
    ? "Please tell us as much as you can: event type, expected schedule, venue access, bump in/out times, number of stages/rooms, or anything you are unsure about..."
    : "Tell us anything useful: load in/out times, access, venue constraints, known requirements..."
}
            />
          </label>

          <div className="span-2 row" style={{ justifyContent: "flex-end" }}>
            <button type="submit">
             {request.needsCrewAdvice ? "Request a Call" : "Get My Estimate"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}