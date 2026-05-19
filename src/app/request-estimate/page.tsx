"use client";

import { useState, useRef } from "react";
import { useAppConfig } from "@/src/lib/useAppConfig";
import { parseDurationHours } from "@/src/lib/estimator/calc";

import RequestFormHero from "./components/RequestFormHero";
import YourDetailsSection from "./components/YourDetailsSection";
import EventDetailsSection from "./components/EventDetailsSection";
import NeedsAdviceCard from "./components/NeedsAdviceCard";
import CrewSection from "./components/CrewSection";
import NotesSection from "./components/NotesSection";
import SubmitBar from "./components/SubmitBar";
import VerifyEmailScreen from "./components/VerifyEmailScreen";
import SubmittedScreen from "./components/SubmittedScreen";

import styles from "./request-estimate.module.css";
import type {
  PublicCrewLine,
  PublicEstimateRequest,
  Step,
  FieldErrors,
} from "./lib/types";

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
  crewLines: [makeBlankCrewLine()],
};

function makeBlankCrewLine(shiftDate = ""): PublicCrewLine {
  return {
    id: crypto.randomUUID(),
    crewType: "",
    qty: "1",
    shiftDate,
    startTime: "",
    duration: "",
    notes: "",
  };
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function RequestEstimatePage() {
  const { config } = useAppConfig();
  const [request, setRequest] = useState<PublicEstimateRequest>(initialRequest);
  const [step, setStep] = useState<Step>("form");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitBusy, setSubmitBusy] = useState(false);

  // Verify state
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Used to scroll to the first error after a failed submit
  const formRef = useRef<HTMLFormElement>(null);

  // ── State updates ───────────────────────────────────────────────────
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
          // Auto-fill blank shift dates with the event start date
          crewLines: current.crewLines.map((line) => ({
            ...line,
            shiftDate: line.shiftDate || newValue,
          })),
        };
      }
      return { ...current, [field]: value };
    });
    // Clear any error for this field as soon as the user edits it
    setErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }

  function updateCrewLine(id: string, patch: Partial<PublicCrewLine>) {
    setRequest((current) => ({
      ...current,
      crewLines: current.crewLines.map((line) =>
        line.id === id ? { ...line, ...patch } : line
      ),
    }));
    // Clear any per-field errors for the patched keys on this line
    const patchedKeys = Object.keys(patch);
    setErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of patchedKeys) {
        const errKey = `crew_${id}_${k}`;
        if (next[errKey]) {
          delete next[errKey];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  function addCrewLine() {
    setRequest((current) => ({
      ...current,
      crewLines: [...current.crewLines, makeBlankCrewLine(current.eventDate)],
    }));
  }

  function duplicateCrewLine(id: string) {
    setRequest((current) => {
      const source = current.crewLines.find((l) => l.id === id);
      if (!source) return current;
      return {
        ...current,
        crewLines: [
          ...current.crewLines,
          { ...source, id: crypto.randomUUID() },
        ],
      };
    });
  }

  function removeCrewLine(id: string) {
    setRequest((current) => {
      if (current.crewLines.length <= 1) return current;
      return {
        ...current,
        crewLines: current.crewLines.filter((l) => l.id !== id),
      };
    });
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(`crew_${id}_`)) delete next[k];
      }
      return next;
    });
  }

  function handleDurationBlur(id: string, value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsed = parseDurationHours(trimmed);
    const min = config.minBillableHours;
    const errKey = `crew_${id}_duration`;
    if (parsed === null) {
      setErrors((prev) => ({
        ...prev,
        [errKey]: `Enter a valid duration (e.g. ${min}:00 or ${min})`,
      }));
    } else if (parsed < min) {
      setErrors((prev) => ({
        ...prev,
        [errKey]: `Minimum duration is ${min} hours`,
      }));
    }
  }

  // ── Submit & validation ─────────────────────────────────────────────
  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!request.companyName.trim()) next.companyName = "Required";
    if (!request.customerName.trim()) next.customerName = "Required";
    if (!request.email.trim()) {
      next.email = "Required";
    } else if (!emailLooksValid(request.email)) {
      next.email = "Please enter a valid email address";
    }
    if (!request.phone.trim()) next.phone = "Required";
    if (!request.eventName.trim()) next.eventName = "Required";
    if (!request.eventDate.trim()) next.eventDate = "Required";
    if (!request.eventLocation.trim()) next.eventLocation = "Required";

    if (request.needsCrewAdvice) {
      if (!request.notes.trim()) {
        next.notes = "Please tell us about your event so we can help.";
      }
    } else {
      for (const line of request.crewLines) {
        if (!line.crewType.trim()) next[`crew_${line.id}_crewType`] = "Required";
        if (!line.qty.trim()) next[`crew_${line.id}_qty`] = "Required";
        if (!line.shiftDate.trim()) next[`crew_${line.id}_shiftDate`] = "Required";
        if (!line.startTime.trim()) next[`crew_${line.id}_startTime`] = "Required";
        if (!line.duration.trim()) {
          next[`crew_${line.id}_duration`] = "Required";
        } else {
          const parsed = parseDurationHours(line.duration.trim());
          const min = config.minBillableHours;
          if (parsed === null) {
            next[`crew_${line.id}_duration`] = `Enter a valid duration (e.g. ${min}:00 or ${min})`;
          } else if (parsed < min) {
            next[`crew_${line.id}_duration`] = `Minimum duration is ${min} hours`;
          }
        }
      }
    }

    return next;
  }

  function scrollToFirstError() {
    // Small delay so the DOM has the error classes applied before we scroll
    setTimeout(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`.${styles.hasError}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          "input, select, textarea"
        );
        if (input) input.focus({ preventScroll: true });
      }
    }, 50);
  }

  async function sendVerificationCode(): Promise<boolean> {
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
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      scrollToFirstError();
      return;
    }

    setSubmitBusy(true);
    const sent = await sendVerificationCode();
    setSubmitBusy(false);

    if (!sent) {
      setErrors({
        email: "Failed to send verification email. Please check the address and try again.",
      });
      scrollToFirstError();
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
      body: JSON.stringify({
        email: request.email,
        code: verifyCode.trim(),
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      setVerifyBusy(false);
      setVerifyError("Invalid or expired code. Please check and try again.");
      return;
    }

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

  // ── Render ──────────────────────────────────────────────────────────
  if (step === "submitted") {
    return (
      <main className={styles.requestPage}>
        <SubmittedScreen
          needsCrewAdvice={request.needsCrewAdvice}
          onSubmitAnother={() => {
            setRequest(initialRequest);
            setStep("form");
            setErrors({});
          }}
        />
      </main>
    );
  }

  if (step === "verify") {
    return (
      <main className={styles.requestPage}>
        <VerifyEmailScreen
          email={request.email}
          code={verifyCode}
          error={verifyError}
          busy={verifyBusy}
          resendCooldown={resendCooldown}
          onCodeChange={setVerifyCode}
          onVerify={handleVerify}
          onBack={() => setStep("form")}
          onResend={handleResend}
        />
      </main>
    );
  }

  return (
    <main className={styles.requestPage}>
      <div className={styles.container}>
        <RequestFormHero />

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <YourDetailsSection
            request={request}
            errors={errors}
            onChange={updateField}
          />

          <EventDetailsSection
            request={request}
            errors={errors}
            onChange={updateField}
          />

          <NeedsAdviceCard
            checked={request.needsCrewAdvice}
            onChange={(checked) => updateField("needsCrewAdvice", checked)}
          />

          {!request.needsCrewAdvice && (
            <CrewSection
              crewLines={request.crewLines}
              errors={errors}
              onChangeLine={updateCrewLine}
              onAdd={addCrewLine}
              onDuplicate={duplicateCrewLine}
              onRemove={removeCrewLine}
              onDurationBlur={handleDurationBlur}
            />
          )}

          <NotesSection
            value={request.notes}
            required={request.needsCrewAdvice}
            error={errors.notes}
            onChange={(value) => updateField("notes", value)}
          />

          <SubmitBar
            needsCrewAdvice={request.needsCrewAdvice}
            busy={submitBusy}
          />
        </form>
      </div>
    </main>
  );
}
