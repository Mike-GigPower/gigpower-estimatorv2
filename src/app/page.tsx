"use client";

/**
 * Main page-level UI components
 */
import AppHeader from "./components/AppHeader";
import DraftToolbar from "./components/DraftToolbar";
import ClientDetailsCard from "./components/ClientDetailsCard";
import { sortLabourByDate } from "@/src/lib/estimator/pdfRows";
import LabourTable from "./components/LabourTable";
import NonLabourTable from "./components/NonLabourTable";
import QuoteTotalsCard from "./components/QuoteTotalsCard";
import TermsConditionsBox from "./components/TermsConditionsBox";
import { supabaseData } from "@/src/lib/supabase";
import { createClient } from "@/src/lib/supabase/client";
import { parseDurationHours } from "@/src/lib/estimator/calc";

/**
 * React hooks
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";



/**
 * Quote calculation engine and app configuration hook
 */
import { useAppConfig } from "@/src/lib/useAppConfig";
import { buildCrewFinderPayload, downloadCrewFinderJson } from "@/src/lib/crewfinderExport";
import {
  addDaysToDDMMYYYY,
  autoColonHHMM,
  ddmmyyyyToIso,
  formatDateDDMMYYYY,
  hoursToHHMM,
  isQuoteEmpty,
  normaliseHHMM,
  normaliseInputRoles,
  sortLabourLinesByDate,
  calculateQuoteTotals,
} from "@/src/lib/estimator/calc";

/**
 * Shared app types
 */
import type {
  QuoteInput,
  LabourLine,
  NonLabourLine,
  QuoteResult,
} from "@/src/lib/estimator/types";

import { roleForCallName } from "@/src/lib/types";

type SavedDraft = {
  id: string;
  name: string;
  savedAt?: string | null;
  updatedAt?: string | null;
  currentVersion?: number;
  input: QuoteInput;
  createdByName?: string;
};


/**
 * Create a simple unique id for new rows.
 * Example output: lab_ab12xyz
 */
function uid(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

/**
 * Format a number as currency using the app's configured currency.
 * Falls back to AUD if no currency is supplied.
 */
function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
  }).format(n || 0);
}




/**
 * Browser storage key for saved drafts.
 */

const SELECTED_DRAFT_KEY = "gigpower-selected-estimate";

// Stable display/scroll order for mandatory header-field errors. Keys match
// the DOM ids assigned to each field (id="field-<key>").
const HEADER_FIELD_ORDER = [
  "companyName",
  "contactName",
  "contactEmail",
  "eventName",
  "eventDate",
  "venue",
] as const;

/**
 * Create a new blank labour line with sensible defaults.
 */
function emptyLabourLine(defaultRole = "", minBillableHours = 4, shiftDate = ""): LabourLine {
  return {
    id: uid("lab"),
    // Role is derived from callName via roleForCallName; defaultRole is the
    // fallback used until the user picks a Call Name on the new row.
    role: defaultRole,
    qty: 1,
    shiftDate,
    startTime: "08:00",
    durationHours: minBillableHours,
    notes: "",
    callName: "",
  };
}

/**
 * Create a new blank non-labour line.
 */
function emptyNonLabourLine(): NonLabourLine {
  return {
    id: uid("nl"),
    title: "",
    description: "",
    qty: 1,
    amountExGst: 0,
  };
}

function downloadPdf() {
  window.print();
}


/**
 * Generate the quote number.
 * Example: GP-12345
 */
async function generateQuoteNumber(): Promise<string> {
  const { data, error } = await supabaseData.rpc("next_quote_number");

  if (error || !data) {
    throw new Error(error?.message || "Failed to generate quote number");
  }

  return data;
}

const defaultInput: QuoteInput = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  venue: "",
  notes: "",
  quoteNumber: "",
  quoteDate: "",
  validUntil: "",
  status: "Draft",
  labour: [emptyLabourLine("", 4, "")],
  nonLabour: [emptyNonLabourLine()],
};

/**
 * Main page component.
 */
export default function Page() {
  
  const router = useRouter();
  const [supabase] = useState(() => createClient());
const authClient = supabase;
  /**
   * Load configuration such as rates, GST, min hours, quote text, currency, etc.
   */
  const { config, ready } = useAppConfig();

  /**
   * Convenience function to format money using the configured currency.
   */
  const moneyFmt = (n: number) => money(n, config.currency);


  /**
   * Main quote input state.
   * This is what the user edits on the screen.
   */
  const [input, setInput] = useState<QuoteInput>(defaultInput);
  const [estimatorVisible, setEstimatorVisible] = useState(false);
const [draftName, setDraftName] = useState("Untitled Estimate");
const [statusFilter, setStatusFilter] = useState("");
const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
const [selectedDraftId, setSelectedDraftId] = useState("");
const [isMounted, setIsMounted] = useState(false);
const [showStartNewConfirm, setShowStartNewConfirm] = useState(false);
const [preparedBy, setPreparedBy] = useState("");
const [validUntilManuallyEdited, setValidUntilManuallyEdited] = useState(false);
const [pendingLoadId, setPendingLoadId] = useState<string | null>(null);
const [currentUserRole, setCurrentUserRole] = useState("");
const isAdmin = currentUserRole === "admin";

// Undo toast for labour-row deletion (#6). Holds the removed line plus the
// index it occupied, so Undo restores it to the same position. A token lets
// the auto-dismiss timer ignore stale timeouts when toasts are replaced.
const [deletedLabour, setDeletedLabour] = useState<
  { line: LabourLine; index: number; token: number } | null
>(null);

// Snapshot of the last loaded/saved estimate (serialised QuoteInput), used to
// detect *unsaved changes*. Distinct from "is the quote empty": a saved,
// untouched estimate is non-empty but has no unsaved changes, so loading
// another over it should NOT warn. null = no baseline (fresh/blank session).
const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

// Inline validation for mandatory header fields. Populated on a save attempt;
// each entry is keyed by field (companyName, contactEmail, …) with a human-
// readable message. While populated, the fields highlight and a summary banner
// shows. Entries prune themselves as fields become valid (see effect below).
// `triggeredSave` gates the pruning effect so highlights only appear *after*
// the user has tried to save — not while first filling the form in.
const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
const [triggeredSave, setTriggeredSave] = useState(false);

// Auto-dismiss the undo toast ~7s after it appears. Keyed on token so a new
// deletion resets the timer and replaces any in-flight one (#6).
useEffect(() => {
  if (!deletedLabour) return;
  const t = setTimeout(() => {
    setDeletedLabour((current) =>
      current && current.token === deletedLabour.token ? null : current
    );
  }, 7000);
  return () => clearTimeout(t);
}, [deletedLabour]);

// Once the user has attempted a save, keep the inline header-field errors in
// sync as they fix things: recompute on every edit and clear entries that are
// now valid. Does nothing until the first save attempt, so the form doesn't
// light up red while it's still being filled in for the first time.
useEffect(() => {
  if (!triggeredSave) return;

  const next = collectHeaderErrors({
    ...input,
    eventName: input.eventName || draftName,
  });

  setHeaderErrors((prev) => {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    const sameLength = prevKeys.length === nextKeys.length;
    const sameEntries = sameLength && nextKeys.every((k) => prev[k] === next[k]);
    // Avoid setting state (and re-rendering) when nothing actually changed.
    return sameEntries ? prev : next;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [input, draftName, triggeredSave]);

useEffect(() => {
  const stored = localStorage.getItem("loadedEstimateRequest");

  if (!stored) return;

  const loaded = JSON.parse(stored);
  const payload = loaded.payload || loaded;

  const sourceRequestId =
    loaded.sourceRequestId || loaded.requestId || "";

  const requestNumber =
  loaded.requestNumber ||
  payload.requestNumber ||
  loaded.estimate_number ||
  payload.estimate_number ||
  "";

  setInput((prev) => ({
    ...prev,
    // Keep Estimate # separate from Request #
    quoteNumber: prev.quoteNumber || "",
    // Link back to source Request
    sourceRequestId,
    requestNumber,
    status: "Draft",
    companyName: payload.companyName || "",
    contactName: payload.customerName || "",
    contactEmail: payload.email || "",
    contactPhone: payload.phone || "",
    venue: payload.eventLocation || "",
    notes: payload.notes || "",
    labour: (payload.crewLines || []).map((line: any) => {
      const callName = line.crewType || "";
      return {
        id: crypto.randomUUID(),
        // The request now stores the SmartStaff Call Name in `crewType`.
        // The rate role is derived from it via roleForCallName.
        role: roleForCallName(callName),
        callName,
        qty: Number(line.qty),
        shiftDate: line.shiftDate,
        startTime: line.startTime,
        durationHours: parseDurationHours(line.duration) ?? 0,
        notes: line.notes,
      };
    }),
  }));

  localStorage.setItem("convertedEstimateRequestId", sourceRequestId);

  localStorage.removeItem("loadedEstimateRequest");
}, []);

useEffect(() => {
  let isActive = true;

  async function initPage() {
    const { data, error } = await authClient.auth.getSession();

    if (!isActive) return;

    if (error || !data.session) {
      router.replace("/login");
      return;
    }

    const user = data.session.user;

    const { data: userProfile, error: profileError } = await authClient
      .from("profiles")
      .select("is_active, full_name, email, role")
      .eq("id", user.id)
      .single();

    if (!isActive) return;

    if (profileError || !userProfile?.is_active) {
      setIsMounted(true);
      router.replace("/login");
      return;
    }

    setPreparedBy(
      userProfile.full_name ||
        userProfile.email ||
        user.email ||
        "GigPower"
    );
    setCurrentUserRole(userProfile.role || "");

    setIsMounted(true);
    loadAllDrafts();
  }

  initPage();

  return () => {
    isActive = false;
  };
}, [router, authClient]);
  /**
   * Once config is ready, ensure there is at least one labour line.
   * This helps when the page loads before rates/config are available.
   */
  useEffect(() => {
    if (!ready) return;

    setInput((prev) => {
      if (prev.labour.length > 0) return prev;

      return {
        ...prev,
        labour: [
          emptyLabourLine(
  config.rates[0]?.role ?? "",
  isAdmin ? 0 : config.minBillableHours
),
        ],
      };
    });
  }, [ready, config]);
  
  useEffect(() => {
  if (!ready) return;

  
  const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
  

  setInput((prev) => ({
    ...prev,
    quoteNumber: prev.quoteNumber || "",
    quoteDate: prev.quoteDate || formatDateDDMMYYYY(today),
    validUntil:
    prev.validUntil ||
    addDaysToDDMMYYYY(prev.quoteDate || formatDateDDMMYYYY(today), 14),
    labour: prev.labour.map((line) => ({
      ...line,
      id: line.id || uid("lab"),
      shiftDate: line.shiftDate || todayIso,
    })),
    nonLabour: prev.nonLabour.map((line) => ({
      ...line,
      id: line.id || uid("nl"),
    })),
  }));
}, [ready]);



  /**
   * Holds the calculated result of the quote engine.
   */
  const [result, setResult] = useState<QuoteResult | null>(null);

  /**
   * Tracks whether a recalculation is in progress. Set around the auto-recalc
   * effect. (The manual "Recalculate" button was removed — calc is automatic —
   * but the flag is retained for any future in-progress UI indicator.)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [busy, setBusy] = useState(false);

  /**
   * Temporary text state for duration and start time inputs.
   * These allow the UI to hold user typing before values are normalised.
   */
  const [durationText, setDurationText] = useState<Record<string, string>>({});
  const [startTimeText, setStartTimeText] = useState<Record<string, string>>({});


  /**
   * Build role dropdown options from configured rates.
   */
  const roleOptions = useMemo(
    () => config.rates.map((r) => r.role),
    [config.rates]
  );

  /**
   * Search text used to filter saved quotes.
   */
  const [quoteSearch, setQuoteSearch] = useState("");

  
  /**
   * Central update function.
   * Normalises roles first once config is ready, then updates input state.
   */
  function recalc(next: QuoteInput) {
    const normalised = ready ? normaliseInputRoles(next, config) : next;
    setInput(normalised);
  }

  function calculateCurrentQuote(nextInput: QuoteInput) {
    const effectiveConfig = isAdmin
      ? { ...config, minBillableHours: 0 }
      : config;
    return calculateQuoteTotals(nextInput, effectiveConfig);
  }

  /**
   * When config changes, make sure all labour rows still reference valid configured roles.
   */
  useEffect(() => {
    if (!ready) return;

    setInput((prev) => normaliseInputRoles(prev, config));
  }, [ready, config]);

  /**
   * Recalculate quote whenever input or config changes.
   * Also toggles the busy flag around the calculation.
   */
  useEffect(() => {
    if (!ready) return;

    setBusy(true);
    try {
      setResult(calculateCurrentQuote(input));
    } finally {
      setBusy(false);
    }
  }, [input, config, ready, isAdmin]);

  /**
   * Original file also includes this second recalculation effect.
   * It directly recalculates result whenever config/input/ready changes.
   * This is preserved exactly to avoid changing behaviour.
   */
  useEffect(() => {
    if (!ready) return;
    setResult(calculateCurrentQuote(input));
  }, [config, input, ready, isAdmin]);

  /**
   * Remember the currently selected draft id between refreshes.
   */
  useEffect(() => {
  if (selectedDraftId) {
    localStorage.setItem(SELECTED_DRAFT_KEY, selectedDraftId);
  } else {
    localStorage.removeItem(SELECTED_DRAFT_KEY);
  }
}, [selectedDraftId]);

  /**
   * Update one labour row by id.
   */
  function updateLabour(id: string, patch: Partial<LabourLine>) {
    const next = {
      ...input,
      labour: input.labour.map((l) =>
        l.id === id ? { ...l, ...patch } : l
      ),
    };
    recalc(next);
  }

  /**
   * Update one non-labour row by id.
   */
  function updateNonLabour(id: string, patch: Partial<NonLabourLine>) {
    const next = {
      ...input,
      nonLabour: input.nonLabour.map((l) =>
        l.id === id ? { ...l, ...patch } : l
      ),
    };
    recalc(next);
  }

  /**
   * Add a new labour row.
   * Uses the first configured role as the default role if available.
   */
  function addLabour() {
    const next = {
      ...input,
      labour: [
        ...input.labour,
        emptyLabourLine(config.rates[0]?.role ?? "", config.minBillableHours),
      ],
    };
    recalc(next);
  }

  /**
   * Remove a labour row by id. Captures the removed line and its position so
   * the deletion can be undone via the toast (#6).
   */
  function removeLabour(id: string) {
    const index = input.labour.findIndex((l) => l.id === id);
    if (index === -1) return;

    const removed = input.labour[index];
    const next = { ...input, labour: input.labour.filter((l) => l.id !== id) };
    recalc(next);

    setDeletedLabour({ line: removed, index, token: Date.now() });
  }

  /**
   * Restore the most recently deleted labour row to its original position.
   */
  function restoreLabour() {
    if (!deletedLabour) return;

    const restored = [...input.labour];
    const at = Math.min(deletedLabour.index, restored.length);
    restored.splice(at, 0, deletedLabour.line);

    const next = { ...input, labour: restored };
    recalc(next);

    setDeletedLabour(null);
  }

  /**
   * Dismiss the undo toast, committing the deletion.
   */
  function dismissDeletedToast() {
    setDeletedLabour(null);
  }

  /**
   * Duplicate a labour row and insert the copy immediately after the original.
   */
  function duplicateLabour(id: string) {
    const idx = input.labour.findIndex((l) => l.id === id);
    if (idx === -1) return;

    const original = input.labour[idx];
    const copy = { ...original, id: uid("lab") };

    const updated = [...input.labour];
    updated.splice(idx + 1, 0, copy);

    const next = { ...input, labour: updated };
    recalc(next);
  }

  /**
   * Sort labour rows by shift date, then start time, then role name.
   */
  function sortLabourByDate() {
    const sorted = sortLabourLinesByDate(input.labour);

    const next = { ...input, labour: sorted };
    recalc(next);
  }

  /**
   * Add a new non-labour row.
   */
  function addNonLabour() {
    const next = { ...input, nonLabour: [...input.nonLabour, emptyNonLabourLine()] };
    recalc(next);
  }

  /**
   * Remove a non-labour row by id.
   */
  function removeNonLabour(id: string) {
    const next = { ...input, nonLabour: input.nonLabour.filter((l) => l.id !== id) };
    recalc(next);
  }

  /**
   * Update the quote header/client details section.
   */
  function updateHeader(
    patch: Partial<
      Pick<
        QuoteInput,
        "companyName" | "contactName" | "contactEmail" | "contactPhone" | "venue" | "notes" | "eventName" | "eventDate" | "onsiteContact" | "onsiteContactPhone"
      >
    >
  ) {
    let next = { ...input, ...patch };

    // When the event date is set/changed, default the FIRST labour line's
    // shift date to it — but only if that line doesn't already have a date
    // (don't clobber a date the user has explicitly typed).
    if (patch.eventDate && next.labour.length > 0 && !next.labour[0].shiftDate) {
      next = {
        ...next,
        labour: next.labour.map((line, i) =>
          i === 0 ? { ...line, shiftDate: patch.eventDate as string } : line
        ),
      };
    }

    recalc(next);
  }
  
function resetToBlankQuote() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const valid = new Date();
  valid.setDate(today.getDate() + 14);

  const freshInput: QuoteInput = {
    ...defaultInput,
    quoteNumber: "",
    quoteDate: formatDateDDMMYYYY(today),
    validUntil: formatDateDDMMYYYY(valid),
    labour: [emptyLabourLine(config.rates[0]?.role ?? "", config.minBillableHours, "")],
    nonLabour: [emptyNonLabourLine()],
  };

  setDraftName("Untitled Estimate");
  setSelectedDraftId("");
  setInput(freshInput);
  setResult(calculateCurrentQuote(freshInput));
  setSavedSnapshot(null);
  setDurationText({});
  setStartTimeText({});
  setHeaderErrors({});
  setTriggeredSave(false);
}

/**
 * True when the current quote has changes that would be lost if discarded.
 *
 * - Empty quote -> never "unsaved" (nothing to lose).
 * - A loaded/saved estimate left untouched -> NOT unsaved (matches the saved
 *   snapshot), so loading another over it shouldn't warn.
 * - Non-empty with no saved baseline (typed but never saved) -> treated as
 *   unsaved.
 * - Non-empty and differs from the saved snapshot -> unsaved.
 */
function hasUnsavedChanges(): boolean {
  const empty = isQuoteEmpty({
    input,
    draftName,
    minBillableHours: config.minBillableHours,
  });
  if (empty) return false;

  // Non-empty but never saved/loaded: there's content worth protecting.
  if (savedSnapshot === null) return true;

  // Non-empty with a baseline: dirty only if it differs from what was saved.
  return JSON.stringify(input) !== savedSnapshot;
}

function handleStartNew() {
  if (!hasUnsavedChanges()) {
    resetToBlankQuote();
    setValidUntilManuallyEdited(false);
    setEstimatorVisible(true);
    return;
  }

  setShowStartNewConfirm(true);
}

function handleLoadEstimate(id: string) {
  if (!estimatorVisible || !hasUnsavedChanges()) {
    loadDraftById(id);
    return;
  }

  setPendingLoadId(id);
  setShowStartNewConfirm(true);
}

async function handleSaveAndStartNew() {
  await saveDraft(selectedDraftId || undefined);

  if (pendingLoadId) {
    await loadDraftById(pendingLoadId);
    setPendingLoadId(null);
  } else {
    resetToBlankQuote();
    setValidUntilManuallyEdited(false);
    setEstimatorVisible(true);
  }

  setShowStartNewConfirm(false);
}

function handleDiscardAndStartNew() {
  if (pendingLoadId) {
    loadDraftById(pendingLoadId);
    setPendingLoadId(null);
  } else {
    resetToBlankQuote();
    setValidUntilManuallyEdited(false);
    setEstimatorVisible(true);
  }

  setShowStartNewConfirm(false);
}

function handleCancelStartNew() {
  setShowStartNewConfirm(false);
  setPendingLoadId(null);
}

function handleCreateNewEstimate() {
  resetToBlankQuote();
  setValidUntilManuallyEdited(false);
  setShowStartNewConfirm(false);
  setEstimatorVisible(true);
}

async function handleLogout() {
  const confirmed = window.confirm("Are you sure you want to log out?");
  if (!confirmed) return;

  await authClient.auth.signOut();
  router.replace("/login");
}

async function exportToCrewFinder() {
  if (input.status !== "Approved") {
    alert("Only Approved estimates can be exported to CrewFinder.");
    return;
  }

  const { data: sessionData, error: sessionError } =
    await authClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    alert("Your session has expired. Please log in again.");
    router.replace("/login");
    return;
  }

  const userEmail = sessionData.session.user.email || "unknown";
  const now = new Date().toISOString();

  const payload = buildCrewFinderPayload(input, {
    estimateId: selectedDraftId || `est_${Date.now()}`,
    version: selectedDraftMeta?.currentVersion ?? 1,
    createdAt: selectedDraftMeta?.savedAt || now,
    approvedAt: now,
    createdBy: selectedDraftMeta?.createdByName || userEmail,
    approvedBy: userEmail,
    config,
  });

  downloadCrewFinderJson(
    payload,
    input.quoteNumber || "DRAFT",
    selectedDraftMeta?.currentVersion ?? 1
  );

  // Mark as exported and save
  setInput((prev) => ({ ...prev, status: "Exported to Operations" }));
  if (selectedDraftId) {
    await saveDraft(selectedDraftId);
  }
}

async function downloadQuotePdf() {
  try {
    const response = await fetch("/api/quote-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  input,
  result,
  config: {
    ...config,
    termsAndConditions: config?.quoteText?.termsAndConditions || "",
  },
}),
    });

    if (!response.ok) {
      throw new Error("Failed to generate PDF");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${input.quoteNumber || "gigpower-estimate"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Failed to generate PDF.");
  }
}

  /**
   * Validate the current estimate before saving.
   *
   * Returns a list of human-readable error messages; an empty list means the
   * estimate is valid and safe to save.
   *
   * Checks:
   *  - Mandatory header fields: Company Name, Contact Name, Contact Email,
   *    Event/Estimate Name, Event Date, and Venue.
   *  - Every labour line: a Call Name plus all the fields the pricing engine
   *    needs (role, qty > 0, valid shift date, valid start time, duration > 0).
   *    The pricing engine is the source of truth for line-level validity, so
   *    its per-line errors are folded in here too.
   *  - Every non-labour line that has been started: both a Title AND a
   *    Description, qty > 0, and a finite amount >= 0. An untouched default
   *    placeholder row (blank title, blank description, amount 0, qty 1) is
   *    ignored, matching how the pricing engine drops it.
   *  - At least one priceable line overall (labour or non-labour). Non-labour-
   *    only estimates are allowed.
   */
  // Keyed mandatory-header-field validation. This is the single source of
  // truth for header rules: validateBeforeSave folds these into its flat list,
  // and the inline banner/highlight/scroll uses the same keys. Keys match the
  // DOM ids assigned to each field (id="field-<key>") so the first error can be
  // scrolled into view.
  function collectHeaderErrors(candidate: QuoteInput): Record<string, string> {
    const headerErrs: Record<string, string> = {};
    const isBlank = (v?: string) => !v || !v.trim();

    if (isBlank(candidate.companyName)) headerErrs.companyName = "Company Name is required.";
    if (isBlank(candidate.contactName)) headerErrs.contactName = "Contact Name is required.";

    if (isBlank(candidate.contactEmail)) {
      headerErrs.contactEmail = "Contact Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.contactEmail.trim())) {
      headerErrs.contactEmail = "Contact Email is not a valid email address.";
    }

    if (isBlank(candidate.eventName)) headerErrs.eventName = "Event/Estimate Name is required.";
    if (isBlank(candidate.eventDate)) headerErrs.eventDate = "Event Date is required.";
    if (isBlank(candidate.venue)) headerErrs.venue = "Venue is required.";

    return headerErrs;
  }

  function validateBeforeSave(candidate: QuoteInput): string[] {
    const errors: string[] = [];

    // ── Mandatory header fields ──────────────────────────────────────────
    // Use the keyed helper so the header rules live in exactly one place, then
    // append them to the flat list in the established display order.
    const headerErrs = collectHeaderErrors(candidate);
    HEADER_FIELD_ORDER.forEach((key) => {
      if (headerErrs[key]) errors.push(headerErrs[key]);
    });

    // ── Labour lines ─────────────────────────────────────────────────────
    // Reuse the pricing engine to validate every field on every labour line.
    const evaluation = calculateCurrentQuote(candidate);

    candidate.labour.forEach((line, index) => {
      const label = `Labour line ${index + 1}`;

      if (!line.callName) errors.push(`${label}: a Call Name is required.`);
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        errors.push(`${label}: crew quantity must be greater than 0.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(line.shiftDate || "")) {
        errors.push(`${label}: a valid shift date is required.`);
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(line.startTime || "")) {
        errors.push(`${label}: a valid start time (HH:MM) is required.`);
      }
      if (!Number.isFinite(line.durationHours) || line.durationHours <= 0) {
        errors.push(`${label}: duration must be greater than 0.`);
      }
    });

    // Fold in any remaining fatal pricing errors (e.g. an unknown role) that
    // the per-field checks above didn't already surface. The non-blocking
    // "below minimum" advisory is intentionally excluded.
    evaluation.validationErrors
      .filter((e) => !e.toLowerCase().includes("below minimum"))
      .forEach((e) => {
        if (!errors.includes(e)) errors.push(e);
      });

    // ── Non-labour lines ─────────────────────────────────────────────────
    // Track whether at least one non-labour line is actually filled in, so a
    // non-labour-only estimate can still satisfy the "at least one line" rule.
    let hasFilledNonLabour = false;

    candidate.nonLabour.forEach((line, index) => {
      const titleBlank = !line.title || !line.title.trim();
      const descBlank = !line.description || !line.description.trim();
      const amountZero = line.amountExGst === 0 || !Number.isFinite(line.amountExGst);

      // Ignore an untouched placeholder row (matches the pricing engine).
      const isUntouchedPlaceholder =
        titleBlank && descBlank && amountZero && line.qty === 1;
      if (isUntouchedPlaceholder) return;

      hasFilledNonLabour = true;

      const label = `Non-labour line ${index + 1}`;
      if (titleBlank) errors.push(`${label}: a Title is required.`);
      if (descBlank) errors.push(`${label}: a Description is required.`);
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        errors.push(`${label}: quantity must be greater than 0.`);
      }
      if (!Number.isFinite(line.amountExGst) || line.amountExGst < 0) {
        errors.push(`${label}: amount (ex GST) must be 0 or greater.`);
      }
    });

    // ── At least one priceable line ──────────────────────────────────────
    if (candidate.labour.length === 0 && !hasFilledNonLabour) {
      errors.push("Add at least one labour or non-labour line.");
    }

    return errors;
  }

  /**
   * Scroll a mandatory header field into view and focus it, used when a save
   * attempt fails validation. Fields carry id="field-<key>" (e.g.
   * "field-companyName"). Safe no-op if the element isn't found.
   */
  function scrollToField(key: string) {
    if (typeof document === "undefined") return;
    const el = document.getElementById(`field-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Focus after the scroll settles so it doesn't fight the smooth scroll.
    window.setTimeout(() => {
      (el as HTMLElement).focus({ preventScroll: true });
    }, 300);
  }

  /**
   * Save a draft.
   * If overwriteId matches an existing draft, update that draft.
   * Otherwise create a new draft.
   */
async function saveDraft(overwriteId?: string) {
  // Validate mandatory fields and every line before doing any work. Abort if
  // anything is invalid.
  const candidate = {
    ...input,
    // eventName falls back to the draft name, matching how it is displayed.
    eventName: input.eventName || draftName,
  };

  // From now on, header fields show inline validation as they're edited.
  setTriggeredSave(true);

  // Mandatory header fields get inline treatment: highlight + summary banner +
  // scroll to the first offender, instead of a blocking popup.
  const headerErrs = collectHeaderErrors(candidate);
  setHeaderErrors(headerErrs);

  if (Object.keys(headerErrs).length > 0) {
    const firstKey = HEADER_FIELD_ORDER.find((k) => headerErrs[k]);
    if (firstKey) scrollToField(firstKey);
    return;
  }

  // Header is valid — clear any lingering inline errors from a prior attempt.
  setHeaderErrors({});

  // Header is valid. Line-level (labour / non-labour) problems still use the
  // existing summary popup for now — those aren't part of the inline pass yet.
  const validationErrors = validateBeforeSave(candidate);

  if (validationErrors.length > 0) {
    alert(
      "This estimate can't be saved yet. Please fix the following:\n\n" +
        validationErrors.map((e) => `• ${e}`).join("\n")
    );
    return;
  }

  const now = new Date().toISOString();
const name = (draftName || "Untitled Estimate").trim();

const { data: sessionData, error: sessionError } = await authClient.auth.getSession();

if (sessionError || !sessionData.session) {
  alert("Your session has expired. Please log in again.");
  router.replace("/login");
  return;
}

const actorId = sessionData.session.user.id;
const actorLabel = sessionData.session.user.email || "unknown user";

  const quoteNumber = overwriteId
    ? input.quoteNumber || await generateQuoteNumber()
    : await generateQuoteNumber();
  const quoteDateValue = input.quoteDate || formatDateDDMMYYYY(new Date());

const validUntilValue =
  input.validUntil ||
  (() => {
    const baseDate = ddmmyyyyToIso(quoteDateValue);
    const d = baseDate ? new Date(baseDate) : new Date();

    d.setDate(d.getDate() + 14);
    return formatDateDDMMYYYY(d);
  })();

const ensuredInput: QuoteInput = {
  ...input,
  quoteNumber,
  quoteDate: quoteDateValue,
  validUntil: validUntilValue,
  status: input.status || "Draft",
};
  // Update an existing quote and create a new history version
  if (overwriteId) {
    const { data: existingQuote, error: fetchError } = await supabaseData
      .from("quotes")
      .select("id, current_version")
      .eq("id", overwriteId)
      .single();

    if (fetchError) {
      console.error("Error loading estimate:", fetchError);
  alert("Error loading estimate: " + fetchError.message);
  return;
    }

    const nextVersion = (existingQuote?.current_version || 1) + 1;

    const { error: updateError } = await supabaseData
  .from("quotes")
  .update({
    name,
    quote_number: ensuredInput.quoteNumber,

    // Link estimate back to source request
    source_request_id: ensuredInput.sourceRequestId || null,
    request_number: ensuredInput.requestNumber || null,

    status: ensuredInput.status,
    quote_date: ddmmyyyyToIso(ensuredInput.quoteDate),
    valid_until: ddmmyyyyToIso(ensuredInput.validUntil),
    payload: ensuredInput,
    updated_at: now,
    updated_by: actorId,
    current_version: nextVersion,
  })
  .eq("id", overwriteId);

    if (updateError) {
  console.error("Error updating estimate:", updateError);
  alert("Error updating estimate: " + updateError.message);
  return;
}

    const { error: versionError } = await supabaseData
      .from("quote_versions")
      .insert([
        {
          quote_id: overwriteId,
          version_number: nextVersion,
          saved_at: now,
          saved_by: actorLabel,
          input: ensuredInput,
          change_summary: "Updated estimate",
        },
      ]);

    if (versionError) {
      alert("Estimate updated, but failed to write version history: " + versionError.message);
      return;
    }

    setInput(ensuredInput);
    setSavedSnapshot(JSON.stringify(ensuredInput));
    alert(`Estimate updated. Version ${nextVersion} saved.`);
    await loadAllDrafts();
    return;
  }

  // Save a new quote and create version 1 history
  const { data: insertedQuote, error: insertError } = await supabaseData
    .from("quotes")
    .insert([
      {
        name,
        quote_number: ensuredInput.quoteNumber,
        source_request_id: ensuredInput.sourceRequestId || null,
request_number: ensuredInput.requestNumber || null,
        quote_date: ddmmyyyyToIso(ensuredInput.quoteDate),
        valid_until: ddmmyyyyToIso(ensuredInput.validUntil),
        payload: ensuredInput,
        created_at: now,
        updated_at: now,
        created_by: actorId,
        updated_by: actorId,
        current_version: 1,
        is_deleted: false,
      },
    ])
    .select("id")
    .single();

    if (insertError) {
      console.error("Error saving estimate:", insertError);
  alert("Error saving estimate: " + insertError.message);
  return;
    }

    const { error: versionError } = await supabaseData
      .from("quote_versions")
      .insert([
        {
          quote_id: insertedQuote.id,
          version_number: 1,
          saved_at: now,
          saved_by: actorLabel,
          input: ensuredInput,
          change_summary: "Initial version",
        },
      ]);

    if (versionError) {
    console.error("Estimate saved, but failed to write version history:", versionError);
  alert("Estimate saved, but failed to write version history: " + versionError.message);
  return;
      
    }

    setInput(ensuredInput);
    setSavedSnapshot(JSON.stringify(ensuredInput));
    setSelectedDraftId(insertedQuote.id);
    alert("Estimate saved (shared across users). Version 1 created.");
    await loadAllDrafts();
    
    const convertedRequestId = localStorage.getItem("convertedEstimateRequestId");

console.log("convertedRequestId on save:", convertedRequestId);

if (convertedRequestId && convertedRequestId !== "undefined") {
  const { data, error: updateError } = await authClient
  .from("estimate_requests")
  .update({
  status: "Quoted",
  quoted_at: new Date().toISOString(),
  quote_number: ensuredInput.quoteNumber,
})
  .eq("id", convertedRequestId)
  .select();
    
    console.log("Update result:", data);

  if (updateError) {
    console.error("Failed to update request status:", updateError);
    alert("Failed to update request status: " + updateError.message);
  } else {
    console.log("Estimate request marked as quoted:", convertedRequestId);
    alert("Estimate request marked as Quoted.");
    localStorage.removeItem("convertedEstimateRequestId");
  }
}
}

  /**
   * Load a saved draft by id into the current form.
   */
  function loadDraftById(id: string) {
  const draft = savedDrafts.find((d) => d.id === id);

  if (!draft) {
    alert("Saved estimate not found.");
    return;
  }
const draftInput = draft.input || defaultInput;

const hydrated: QuoteInput = {
  ...draftInput,
  quoteNumber: draftInput.quoteNumber || "",
  status: draftInput.status || "Draft",
  quoteDate: draftInput.quoteDate || formatDateDDMMYYYY(new Date()),
  validUntil:
    draftInput.validUntil ||
    (() => {
      const quoteDateValue =
        draftInput.quoteDate || formatDateDDMMYYYY(new Date());

      const baseDate = ddmmyyyyToIso(quoteDateValue);
      const d = baseDate ? new Date(baseDate) : new Date();

      d.setDate(d.getDate() + 14);
      return formatDateDDMMYYYY(d);
    })(),
 labour: sortLabourLinesByDate(
  (draftInput.labour || []).map((line) => ({
    ...line,
    id: line.id || uid("lab"),
    notes: line.notes || "",
  }))
),
  nonLabour: (draftInput.nonLabour || []).map((line) => ({
    ...line,
    id: line.id || uid("nl"),
  })),
};

  const loadedName = draft.name || "Untitled Estimate";
  setDraftName(loadedName);
  setSelectedDraftId(draft.id);
  const hydratedWithEvent = {
    ...hydrated,
    eventName: hydrated.eventName || loadedName,
  };
  // Use the normalised form for BOTH state and the saved-snapshot baseline, so
  // a freshly loaded (untouched) estimate compares as having no unsaved changes.
  const normalisedLoaded = ready
    ? normaliseInputRoles(hydratedWithEvent, config)
    : hydratedWithEvent;
  setInput(normalisedLoaded);
  setResult(calculateCurrentQuote(normalisedLoaded));
  setSavedSnapshot(JSON.stringify(normalisedLoaded));
  setValidUntilManuallyEdited(!!hydrated.validUntil);
  setEstimatorVisible(true);
  setHeaderErrors({});
  setTriggeredSave(false);
}

  /**
   * Delete one saved draft by id.
   */
  async function deleteDraft(id: string) {
  const now = new Date().toISOString();

  const { data: sessionData, error: sessionError } =
    await authClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    alert("Your session has expired. Please log in again.");
    router.replace("/login");
    return;
  }
  const actorId = sessionData.session.user.id;
  const { data: profile } = await authClient
  .from("profiles")
  .select("role")
  .eq("id", actorId)
  .single();

if (!profile || profile.role !== "admin") {
  alert("Only admins can delete estimates.");
  return;
}

  

  const { error } = await supabaseData
    .from("quotes")
    .update({
      is_deleted: true,
      updated_at: now,
      updated_by: actorId,
    })
    .eq("id", id);

  if (error) {
    console.error("Error deleting estimate:", error);
    alert("Error deleting estimate: " + error.message);
    return;
  }

   await loadAllDrafts();

  if (selectedDraftId === id) {
    setSelectedDraftId("");
    setDraftName("");
    
    setInput(defaultInput);
    setEstimatorVisible(false);
  }

  alert("Saved estimate deleted.");
}

  /**
   * Clear all saved drafts from localStorage.
   */
 async function clearAllDrafts() {
  const now = new Date().toISOString();

  const { data: sessionData, error: sessionError } =
    await authClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    alert("Your session has expired. Please log in again.");
    router.replace("/login");
    return;
  }

  const actorId = sessionData.session.user.id;
  
  
  
  const { data: profile } = await authClient
  .from("profiles")
  .select("role")
  .eq("id", actorId)
  .single();

if (!profile || profile.role !== "admin") {
  alert("Only admins can delete estimates.");
  return;
}

  const { error } = await supabaseData
    .from("quotes")
    .update({
      is_deleted: true,
      updated_at: now,
      updated_by: actorId,
    })
    .not("id", "is", null);

  if (error) {
    console.error("Error clearing estimates:", error);
    alert("Error clearing estimates: " + error.message);
    return;
  }

  setSavedDrafts([]);
  setSelectedDraftId("");
  alert("All saved estimates cleared.");
  await loadAllDrafts();
}


  /**
   * Frequently used shortcut for totals.
   */
  const totals = result?.totals;

   const hasLabourData = input.labour.some(
  (l) =>
    (l.callName || "").toString().trim() !== "" ||
    (l.role || "").trim() !== "" ||
    (l.startTime || "").trim() !== "" ||
    (l.durationHours ?? 0) !== 0
);
  
  /**
   * Used to decide whether the non-labour section contains meaningful data.
   */
  const hasNonLabourData = input.nonLabour.some(
    (l) =>
      (l.description || "").trim() !== "" ||
      (l.amountExGst ?? 0) !== 0 ||
      (l.qty ?? 1) !== 1
  );
  
  
  
  function formatSavedDate(value?: string | null) {
  if (!value) return "Not yet saved";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown";

  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadAllDrafts() {
  const { data, error } = await authClient
    .from("quotes")
    .select("*")
    .or("is_deleted.eq.false,is_deleted.is.null")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load drafts:", error);
    setSavedDrafts([]);
    return;
  }

  const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const createdByIds = Array.from(
  new Set(
    (data ?? [])
      .map((row: any) => row.created_by)
      .filter((value: any): value is string => Boolean(value) && isUuid(value))
  )
);

let profiles: any[] = [];

if (createdByIds.length > 0) {
  const { data: profileData, error: profilesError } = await authClient
    .from("profiles")
    .select("id, full_name, email")
    .in("id", createdByIds);

  if (profilesError) {
    console.warn("Failed to load creator profiles:", profilesError);
  }

  profiles = profileData ?? [];
}

  const profileById = new Map(
    (profiles ?? []).map((profile: any) => [profile.id, profile.full_name])
  );

  const drafts: SavedDraft[] = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    savedAt: row.created_at,
    updatedAt: row.updated_at || null,
    currentVersion: row.current_version ?? 1,
    createdByName: profileById.get(row.created_by) || "Unknown",
    status: row.payload?.status || "Draft",

    input: {
      ...defaultInput,
      ...(row.payload || {}),
      quoteNumber: row.payload?.quoteNumber || row.quote_number || "",
      quoteDate: row.payload?.quoteDate || "",
      validUntil: row.payload?.validUntil || "",
      status: row.payload?.status || "Draft",

      labour: (row.payload?.labour || []).map((line: any) => ({
        ...line,
        id: line.id || uid("lab"),
        notes: line.notes || "",
      })),
      nonLabour: (row.payload?.nonLabour || []).map((line: any) => ({
        ...line,
        id: line.id || uid("nl"),
      })),
    },
  }));

  setSavedDrafts(drafts);
}

  /**
 * Filter saved drafts using the toolbar search box and status filter.
 * Matches estimate number, request number, draft name, company name, or contact name.
 */
const filteredDrafts = savedDrafts.filter((d) => {
  const q = quoteSearch.trim().toLowerCase();

  const quoteNumber = d.input?.quoteNumber || "";
  const requestNumber = d.input?.requestNumber || "";
  const companyName = d.input?.companyName || "";
  const contactName = d.input?.contactName || "";
  const draftName = d.name || "";

  const draftStatus = d.input?.status || "Draft";

  const matchesSearch =
    !q ||
    quoteNumber.toLowerCase().includes(q) ||
    requestNumber.toLowerCase().includes(q) ||
    companyName.toLowerCase().includes(q) ||
    contactName.toLowerCase().includes(q) ||
    draftName.toLowerCase().includes(q);

  const matchesStatus = !statusFilter || draftStatus === statusFilter;

  return matchesSearch && matchesStatus;
});

const selectedDraftMeta =
  savedDrafts.find((d) => d.id === selectedDraftId) || null;

 if (!isMounted) {
  return <div className="container">Loading...</div>;
}




const hasAnyData = hasLabourData || hasNonLabourData;

  /**
   * Render page UI.
   */
  return (
    <div className="container">
      
  <AppHeader
  draftName={draftName}
  onLogout={handleLogout}
   isAdmin={isAdmin}
  quoteNumber={input.quoteNumber}
  requestNumber={input.requestNumber}
  quoteDate={input.quoteDate}
  validUntil={input.validUntil}
  onValidUntilChange={(value) => {
  setValidUntilManuallyEdited(true);
  setInput((prev) => ({
    ...prev,
    validUntil: value,
  }));
}}
  version={selectedDraftMeta?.currentVersion ?? 1}
  status={input.status}
  preparedBy={preparedBy}
  companyName={input.companyName}
  contactName={input.contactName}
  contactEmail={input.contactEmail}
  contactPhone={input.contactPhone}
  venue={input.venue}
  eventName={input.eventName}
/>

      <div className="toolbar-section">
        <DraftToolbar
          draftName={draftName}
          setDraftName={(name) => {
            setDraftName(name);
            setInput((prev) => ({ ...prev, eventName: name }));
          }}
          quoteSearch={quoteSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onLoadDraftById={handleLoadEstimate}
          status={input.status || "Draft"}
          createdByName={selectedDraftMeta?.createdByName}
          estimatorVisible={estimatorVisible}
          currentVersion={selectedDraftMeta?.currentVersion ?? 1}
lastSavedAt={selectedDraftMeta?.updatedAt || selectedDraftMeta?.savedAt || null}
setStatus={(value: "Draft" | "Sent" | "Approved" | "Exported to Operations") =>
  setInput({ ...input, status: value })
}
          setQuoteSearch={setQuoteSearch}
          selectedDraftId={selectedDraftId}
          setSelectedDraftId={setSelectedDraftId}
          filteredDrafts={filteredDrafts.map((d) => ({
            id: d.id,
            name: d.name,
            companyName: d.input.companyName,
            quoteNumber: d.input.quoteNumber,
          }))}
          onSaveNew={() => saveDraft()}
          onUpdateSaved={() => saveDraft(selectedDraftId)}
          onLoadSelected={() => selectedDraftId && handleLoadEstimate(selectedDraftId)}
          onDeleteSelected={() => selectedDraftId && deleteDraft(selectedDraftId)}
          onClearAll={handleStartNew}
          onCreateNew={handleCreateNewEstimate}
          onPrint={() => window.print()}
          onDownloadPdf={downloadQuotePdf}
          onExportCrewFinder={exportToCrewFinder}
          eventDate={input.eventDate}
          onEventDateChange={(v) => updateHeader({ eventDate: v })}
          eventNameError={headerErrors.eventName}
          eventDateError={headerErrors.eventDate}
        />
      </div>
      
     
      
      {estimatorVisible && (
  <>

      {Object.keys(headerErrors).length > 0 && (
        <div className="gp-validation-banner" role="alert" aria-live="assertive">
          <div className="gp-validation-banner-head">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 8v5M12 16.5v.5M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <strong>Please complete the required fields before saving.</strong>
            <button
              type="button"
              className="gp-validation-banner-close"
              onClick={() => setHeaderErrors({})}
              aria-label="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <ul className="gp-validation-banner-list">
            {HEADER_FIELD_ORDER.filter((k) => headerErrors[k]).map((k) => (
              <li key={k}>
                <button type="button" onClick={() => scrollToField(k)}>
                  {headerErrors[k]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="hr" />

      <ClientDetailsCard
        input={input}
        onUpdateHeader={updateHeader}
        errors={headerErrors}
      />

      <div className="hr" />

      <div className={!hasLabourData ? "print-hide" : ""}>
  <LabourTable
    labour={input.labour}
    result={
      result
        ? {
            isValid: result.isValid,
            validationErrors: result.validationErrors,
            labourLines: result.labourLines,
          }
        : null
    }
    roleOptions={roleOptions}
    startTimeText={startTimeText}
    setStartTimeText={setStartTimeText}
    durationText={durationText}
    setDurationText={setDurationText}
    updateLabour={updateLabour}
    addLabour={addLabour}
    isAdmin={isAdmin}
    duplicateLabour={duplicateLabour}
    removeLabour={removeLabour}
    sortLabourByDate={sortLabourByDate}
    formatDateDDMMYYYY={formatDateDDMMYYYY}
    normaliseHHMM={normaliseHHMM}
    hoursToHHMM={hoursToHHMM}
    autoColonHHMM={autoColonHHMM}
    money={moneyFmt}
    minBillableHours={isAdmin ? 0 : config.minBillableHours}
  />
</div>

{hasLabourData && hasNonLabourData && <div className="hr" />}

<div className={!hasNonLabourData ? "print-hide" : ""}>
  <NonLabourTable
    nonLabour={input.nonLabour}
    result={
      result
        ? {
            nonLabourLines: result.nonLabourLines,
          }
        : null
    }
    hasNonLabourData={hasNonLabourData}
    addNonLabour={addNonLabour}
    updateNonLabour={updateNonLabour}
    removeNonLabour={removeNonLabour}
    money={moneyFmt}
    gstRate={config.gstRate}
  />
</div>

{hasAnyData && (
  <>
    <div className="hr" />

    <QuoteTotalsCard
      totals={totals ?? null}
      money={moneyFmt}
    />

    <TermsConditionsBox body={config.quoteText.termsAndConditions} />
  </>
)}

  </>
)}
      
      {showStartNewConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.6)",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#111",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Unsaved Changes</h3>
            <p style={{ margin: "12px 0 20px", color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
              You have unsaved changes. Starting a new quote will discard them unless you save first.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleSaveAndStartNew}
                style={{
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontWeight: 700,
                  background: "var(--gp-gold)",
                  color: "#111",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Save and Start New
              </button>

              <button
                onClick={handleDiscardAndStartNew}
                style={{
                  borderRadius: 10,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                }}
              >
                Discard and Start New
              </button>

              <button
                onClick={handleCancelStartNew}
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.55)",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 0 0",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deletedLabour && (
        <div className="gp-toast" role="status" aria-live="polite">
          <span className="gp-toast-msg">Labour line deleted.</span>
          <div className="gp-toast-actions">
            <button
              type="button"
              className="gp-toast-undo"
              onClick={restoreLabour}
            >
              Undo
            </button>
            <button
              type="button"
              className="gp-toast-close"
              onClick={dismissDeletedToast}
              aria-label="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="quote-end-spacer" />
    </div>
  );
}