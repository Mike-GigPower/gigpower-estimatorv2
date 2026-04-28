"use client";

import { useState } from "react";

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
  crewRequired: string;
  crewCount: string;
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
  crewRequired: "",
  crewCount: "",
  notes: "",
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

          <label>
            Crew required
            <input
              value={request.crewRequired}
              onChange={(e) => updateField("crewRequired", e.target.value)}
              placeholder="e.g. show crew, crew boss, forklift, general labour"
            />
          </label>

          <label>
            Estimated crew count
            <input
              type="number"
              min="1"
              value={request.crewCount}
              onChange={(e) => updateField("crewCount", e.target.value)}
            />
          </label>

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