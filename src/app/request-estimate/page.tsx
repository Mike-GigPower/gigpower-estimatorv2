"use client";

import { useState } from "react";
import { useAppConfig } from "@/src/lib/useAppConfig";
import { parseStartTime, parseDurationHours } from "@/src/lib/estimator/calc";
import { REQUEST_UI_CALL_NAMES } from "@/src/lib/types";
import Image from "next/image";

type PublicCrewLine = {
  id: string;
  /**
   * Holds the SmartStaff Call Name selected by the customer (e.g. "Load In").
   * The field name remains "crewType" to keep the API payload shape unchanged,
   * but its meaning is now Call Name. The rate role is derived from this on
   * the server using CALL_NAME_TO_ROLE.
   */
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
      crewType: "",
      qty: "1",
      shiftDate: "",
      startTime: "",
      duration: "",
      notes: "",
    },
  ],
};

type Step = "form" | "verify" | "submitted";

export default function RequestEstimatePage() {
  const { config } = useAppConfig();
  const callNameOptions = REQUEST_UI_CALL_NAMES;
  const [request, setRequest] = useState<PublicEstimateRequest>(initialRequest);
  const [step, setStep] = useState<Step>("form");
  const [durationErrors, setDurationErrors] = useState<Record<string, string>>({});
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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
      return { ...current, [field]: value };
    });
  }

  function updateCrewLine(id: string, patch: Partial<PublicCrewLine>) {
    setRequest((current) => ({
      ...current,
      crewLines: current.crewLines.map((line) =>
        line.id === id ? { ...line, ...patch } : line
      ),
    }));
  }

  function validateDuration(id: string, value: string) {
    const parsed = parseDurationHours(value.trim());
    const min = config.minBillableHours;
    if (!value.trim()) {
      setDurationErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
      return;
    }
    if (parsed === null) {
      setDurationErrors((prev) => ({ ...prev, [id]: `Enter a valid duration (e.g. ${min}:00 or ${min})` }));
    } else if (parsed < min) {
      setDurationErrors((prev) => ({ ...prev, [id]: `Minimum duration is ${min} hours` }));
    } else {
      setDurationErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
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
        crewLines: [...current.crewLines, { ...lineToDuplicate, id: crypto.randomUUID() }],
      };
    });
  }

  function removeCrewLine(id: string) {
    setRequest((current) => {
      if (current.crewLines.length <= 1) return current;
      return { ...current, crewLines: current.crewLines.filter((line) => line.id !== id) };
    });
    setDurationErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function validateCrewLines() {
    for (const line of request.crewLines) {
      if (!line.crewType.trim() || !line.qty.trim() || !line.shiftDate.trim() || !line.startTime.trim() || !line.duration.trim()) {
        return false;
      }
      const parsed = parseDurationHours(line.duration.trim());
      if (parsed === null || parsed < config.minBillableHours) return false;
    }
    return true;
  }

  async function sendVerificationCode() {
    try {
      const res = await fetch("/api/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: request.email }),
      });
      return res.ok;
    } catch (err) {
      console.error("[sendVerificationCode] fetch error:", err);
      return false;
    }
  }

  function startResendCooldown() {
    setResendCooldown(30);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!request.phone.trim()) {
      alert("Please enter a contact phone number.");
      return;
    }

    if (!request.needsCrewAdvice && !validateCrewLines()) {
      alert(`Please complete all crew requirement fields, including a Call Name for each line. Minimum duration is ${config.minBillableHours} hours.`);
      return;
    }

    if (!request.customerName || !request.email || !request.phone || !request.eventName || !request.eventLocation || !request.eventDate) {
      alert("Please complete all required fields.");
      return;
    }

    setVerifyBusy(true);
    const sent = await sendVerificationCode();
    setVerifyBusy(false);

    if (!sent) {
      alert("Failed to send verification email. Please check your email address and try again.");
      return;
    }

    setVerifyCode("");
    setVerifyError("");
    startResendCooldown();
    setStep("verify");
  }

  async function handleVerify() {
    if (!verifyCode.trim()) {
      setVerifyError("Please enter the verification code.");
      return;
    }

    setVerifyBusy(true);
    setVerifyError("");

    const verifyRes = await fetch("/api/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: request.email, code: verifyCode.trim() }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      setVerifyBusy(false);
      setVerifyError("Invalid or expired code. Please check and try again.");
      return;
    }

    // Code verified — submit the request
    const response = await fetch("/api/estimate-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    setVerifyBusy(false);

    if (!data.success) {
      setVerifyError("Something went wrong submitting your request. Please try again.");
      return;
    }

    setStep("submitted");
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setVerifyBusy(true);
    await sendVerificationCode();
    setVerifyBusy(false);
    setVerifyError("");
    setVerifyCode("");
    startResendCooldown();
  }

  // ── Submitted screen ──────────────────────────────────────────────────────
  if (step === "submitted") {
    return (
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="card" style={{ padding: "28px 32px" }}>
          <div style={{ marginBottom: 24 }}>
            <img src="/brand/gigpower-logo.png" alt="GigPower" style={{ height: 50 }} />
          </div>
          <h1>{request.needsCrewAdvice ? "Call request received" : "Estimate request received"}</h1>
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
            <button type="button" onClick={() => { setRequest(initialRequest); setStep("form"); }}>
              Submit another request
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Verification screen ───────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="card" style={{ padding: "28px 32px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <img src="/brand/gigpower-logo.png" alt="GigPower" style={{ height: 50 }} />
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Verify your email</h1>
          <p className="muted" style={{ marginBottom: 24 }}>
            We sent a 6-digit code to <strong>{request.email}</strong>. Enter it below to complete your request.
          </p>

          <label style={{ display: "block", marginBottom: 16 }}>
            Verification code
            <input
              value={verifyCode}
              onChange={(e) => {
                setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setVerifyError("");
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerify(); } }}
              placeholder="123456"
              maxLength={6}
              style={{
                fontSize: 28,
                letterSpacing: 8,
                textAlign: "center",
                marginTop: 8,
                width: "100%",
                padding: "12px 16px",
              }}
              autoFocus
            />
          </label>

          {verifyError && (
            <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{verifyError}</p>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifyBusy || verifyCode.length !== 6}
            style={{ width: "100%", marginBottom: 12 }}
          >
            {verifyBusy ? "Verifying..." : "Confirm & Submit"}
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep("form")}
              disabled={verifyBusy}
            >
              Back to form
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResend}
              disabled={verifyBusy || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <Image
            src="/brand/gigpower-logo.png"
            alt="GigPower"
            width={300}
            height={100}
            style={{ width: "auto", height: "60px", objectFit: "contain", display: "block" }}
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
            <div className="request-form-details-grid">
              <label>
                Company name <span className="required-star">*</span>
                <input value={request.companyName} onChange={(e) => updateField("companyName", e.target.value)} placeholder="Client company" required />
              </label>
              <label>
                Contact name <span className="required-star">*</span>
                <input value={request.customerName} onChange={(e) => updateField("customerName", e.target.value)} placeholder="Contact person" required />
              </label>
              <label>
                Contact email <span className="required-star">*</span>
                <input type="email" value={request.email} onChange={(e) => updateField("email", e.target.value)} placeholder="name@company.com" required />
              </label>
              <label>
                Contact phone <span className="required-star">*</span>
                <input value={request.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="0400 000 000" required />
              </label>
              <label className="span-2">
                Event name <span className="required-star">*</span>
                <input value={request.eventName} onChange={(e) => updateField("eventName", e.target.value)} placeholder="Event name" required />
              </label>
              <label>
                Start date <span className="required-star">*</span>
                <input
                  type="date"
                  value={request.eventDate}
                  onChange={(e) => updateField("eventDate", e.target.value)}
                  onClick={(e) => { const input = e.currentTarget as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                  style={{ cursor: "pointer" }}
                />
              </label>
              <label>
                Venue <span className="required-star">*</span>
                <input value={request.eventLocation} onChange={(e) => updateField("eventLocation", e.target.value)} placeholder="Venue / site" required />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 18, marginBottom: 22 }}>
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
                style={{ transform: "scale(1.2)", margin: 0, width: 16, height: 16, flex: "0 0 auto" }}
              />
              <span>I'm not sure what crew I need — please contact me to discuss.</span>
            </label>
          </div>

          {!request.needsCrewAdvice && (
            <>
              <h2 style={{ fontSize: 18, marginTop: 8 }}>Crew requirements</h2>
              <p className="muted">Add one row per crew type and shift (e.g. different dates or start times).</p>

              {request.crewLines.map((line) => (
                <div key={line.id} className="card" style={{ marginBottom: 12 }}>
                  <div className="request-crew-line-grid">
                    <label>
                      Call Name <span className="required-star">*</span>
                      <select
                        value={line.crewType}
                        onChange={(e) => updateCrewLine(line.id, { crewType: e.target.value })}
                        required
                      >
                        <option value="" disabled>— Select —</option>
                        {callNameOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Qty <span className="required-star">*</span>
                      <input type="number" min="1" value={line.qty} onChange={(e) => updateCrewLine(line.id, { qty: e.target.value })} />
                    </label>
                    <label>
                      Shift date <span className="required-star">*</span>
                      <input
                        type="date"
                        value={line.shiftDate}
                        onChange={(e) => updateCrewLine(line.id, { shiftDate: e.target.value })}
                        onClick={(e) => { const input = e.currentTarget as HTMLInputElement; if (input.showPicker) input.showPicker(); }}
                        style={{ cursor: "pointer" }}
                      />
                    </label>
                    <label>
                      Start time <span className="required-star">*</span>
                      <input
                        value={line.startTime}
                        onChange={(e) => updateCrewLine(line.id, { startTime: e.target.value })}
                        onBlur={(e) => { const parsed = parseStartTime(e.target.value); if (parsed) updateCrewLine(line.id, { startTime: parsed }); }}
                        placeholder="e.g. 10:30pm or 22:30"
                      />
                    </label>
                    <label>
                      Duration <span className="required-star">*</span>
                      <input
                        value={line.duration}
                        onChange={(e) => {
                          updateCrewLine(line.id, { duration: e.target.value });
                          setDurationErrors((prev) => { const next = { ...prev }; delete next[line.id]; return next; });
                        }}
                        onBlur={(e) => validateDuration(line.id, e.target.value)}
                        placeholder={`min ${config.minBillableHours}h — e.g. ${config.minBillableHours}:00`}
                        className={durationErrors[line.id] ? "field-error" : ""}
                      />
                      {durationErrors[line.id] && (
                        <span style={{ fontSize: 12, color: "#ef4444", marginTop: 4, display: "block" }}>
                          {durationErrors[line.id]}
                        </span>
                      )}
                    </label>
                    <div className="request-crew-actions">
                      <button type="button" className="btn-secondary" onClick={() => duplicateCrewLine(line.id)}>Duplicate</button>
                      <button type="button" className="btn-secondary" onClick={() => removeCrewLine(line.id)} disabled={request.crewLines.length <= 1}>Remove</button>
                    </div>
                    <label className="request-crew-notes">
                      Shift Notes
                      <input value={line.notes} onChange={(e) => updateCrewLine(line.id, { notes: e.target.value })} />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addCrewLine}>+ Add crew requirement</button>
            </>
          )}

          <label className="span-2">
            {request.needsCrewAdvice ? (<>Additional notes <span className="required-star">*</span></>) : "Additional notes"}
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
            <button type="submit" disabled={verifyBusy}>
              {verifyBusy ? "Sending code..." : (request.needsCrewAdvice ? "Request a Call" : "Get My Estimate")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}