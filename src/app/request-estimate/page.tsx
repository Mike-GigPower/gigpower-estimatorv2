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

  function updateField(
    field: keyof PublicEstimateRequest,
    value: string
  ) {
    setRequest((current) => ({
      ...current,
      [field]: value,
    }));
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
        shiftDate: "",
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
  if (!validateCrewLines()) {
    alert("Please complete all crew requirement fields.");
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
        <div className="card">
          <h1>Estimate request received</h1>
          <p>
            Thanks — your request has been captured. A GigPower team member will
            review the details and follow up.
          </p>

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
          Tell us about your event and the crew support you need. This is a
          request form only — final pricing will be reviewed by the GigPower
          team.
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
      Company name
      <input
        value={request.companyName}
        onChange={(e) => updateField("companyName", e.target.value)}
        placeholder="Client company"
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

    <label>
      Venue <span className="required-star">*</span>
      <input
        value={request.eventLocation}
        onChange={(e) => updateField("eventLocation", e.target.value)}
        placeholder="Venue / site"
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
      Event date <span className="required-star">*</span>
      <input
        type="date"
        value={request.eventDate}
        onChange={(e) => updateField("eventDate", e.target.value)}
        required
      />
    </label>

    <label style={{ gridColumn: "span 2" }}>
      Notes
      <input
        value={request.notes}
        onChange={(e) => updateField("notes", e.target.value)}
        placeholder="Optional notes"
      />
    </label>
  </div>
</div>

          <div className="span-2">
  <h2 style={{ fontSize: 18, marginTop: 8 }}>Crew requirements</h2>
  <p className="muted">
    Add one row for each crew type, date, start time, and duration required.
  </p>

  {request.crewLines.map((line) => (
  <div key={line.id} className="card" style={{ marginBottom: 12 }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 80px 150px 130px 130px 190px",
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
          onChange={(e) =>
            updateCrewLine(line.id, { shiftDate: e.target.value })
          }
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

      <label style={{ gridColumn: "1 / -1" }}>
        Notes
        <input
          value={line.notes}
          onChange={(e) =>
            updateCrewLine(line.id, { notes: e.target.value })
          }
        />
      </label>

      <div
  style={{
    display: "flex",
    gap: 8,
    alignItems: "end",
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
    </div>
  </div>
))}

  <button type="button" onClick={addCrewLine}>
    + Add crew requirement
  </button>
</div>

          <label className="span-2">
            Additional notes
            <textarea
              value={request.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={5}
              placeholder="Tell us anything useful: load in/out times, access, venue constraints, known requirements..."
            />
          </label>

          <div className="span-2 row" style={{ justifyContent: "flex-end" }}>
            <button type="submit">Submit estimate request</button>
          </div>
        </form>
      </div>
    </main>
  );
}