"use client";

import { useState } from "react";

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
    crewType: "",
    qty: "1",
    shiftDate: "",
    startTime: "",
    duration: "",
    notes: "",
  },
],
};



export default function RequestEstimatePage() {
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
        crewType: "",
        qty: "1",
        shiftDate: "",
        startTime: "",
        duration: "",
        notes: "",
      },
    ],
  }));
}

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Phase 2 only: no database save yet.
    console.log("Public estimate request:", request);
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
        <h1>Request an Estimate</h1>
        <p className="muted">
          Tell us about your event and the crew support you need. This is a
          request form only — final pricing will be reviewed by the GigPower
          team.
        </p>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Contact name
            <input
              value={request.customerName}
              onChange={(e) => updateField("customerName", e.target.value)}
              required
            />
          </label>

          <label>
            Company / organisation
            <input
              value={request.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={request.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
            />
          </label>

          <label>
            Phone
            <input
              value={request.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </label>

          <label>
            Event name
            <input
              value={request.eventName}
              onChange={(e) => updateField("eventName", e.target.value)}
              required
            />
          </label>

          <label>
            Event location
            <input
              value={request.eventLocation}
              onChange={(e) => updateField("eventLocation", e.target.value)}
              required
            />
          </label>

          <label>
            Event date
            <input
              type="date"
              value={request.eventDate}
              onChange={(e) => updateField("eventDate", e.target.value)}
              required
            />
          </label>

          <label>
            Approx start time
            <input
              type="time"
              value={request.startTime}
              onChange={(e) => updateField("startTime", e.target.value)}
            />
          </label>

          <label>
            Approx finish time
            <input
              type="time"
              value={request.endTime}
              onChange={(e) => updateField("endTime", e.target.value)}
            />
          </label>

          <div className="span-2">
  <h2 style={{ fontSize: 18, marginTop: 8 }}>Crew requirements</h2>
  <p className="muted">
    Add one row for each crew type, date, start time, and duration required.
  </p>

  {request.crewLines.map((line) => (
    <div key={line.id} className="card" style={{ marginBottom: 12 }}>
      <label>
        Crew type
        <input
          value={line.crewType}
          onChange={(e) =>
            updateCrewLine(line.id, { crewType: e.target.value })
          }
          placeholder="e.g. Show Crew, Crew Boss, Forklift"
        />
      </label>

      <label>
        Qty
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
        Shift date
        <input
          type="date"
          value={line.shiftDate}
          onChange={(e) =>
            updateCrewLine(line.id, { shiftDate: e.target.value })
          }
        />
      </label>

      <label>
        Start time
        <input
          type="time"
          value={line.startTime}
          onChange={(e) =>
            updateCrewLine(line.id, { startTime: e.target.value })
          }
        />
      </label>

      <label>
        Duration
        <input
          value={line.duration}
          onChange={(e) =>
            updateCrewLine(line.id, { duration: e.target.value })
          }
          placeholder="e.g. 04:00 or 4.5"
        />
      </label>

      <label>
        Notes
        <input
          value={line.notes}
          onChange={(e) =>
            updateCrewLine(line.id, { notes: e.target.value })
          }
        />
      </label>
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
              placeholder="Tell us anything useful: bump in/out times, access, venue constraints, known requirements..."
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