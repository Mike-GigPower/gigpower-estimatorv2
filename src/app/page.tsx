 "use client";

/**
 * Main page-level UI components
 */
import AppHeader from "./components/AppHeader";
import DraftToolbar from "./components/DraftToolbar";
import ClientDetailsCard from "./components/ClientDetailsCard";
import LabourTable from "./components/LabourTable";
import NonLabourTable from "./components/NonLabourTable";
import QuoteTotalsCard from "./components/QuoteTotalsCard";
import TermsConditionsBox from "./components/TermsConditionsBox";
import { supabaseData } from "@/src/lib/supabase";
import { createClient } from "../lib/supabase/client";
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

type SavedDraft = {
  id: string;
  name: string;
  savedAt?: string | null;
  updatedAt?: string | null;
  currentVersion?: number;
  input: QuoteInput;
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

/**
 * Create a new blank labour line with sensible defaults.
 */
function emptyLabourLine(defaultRole = "", minBillableHours = 4, shiftDate = ""): LabourLine {
  return {
    id: uid("lab"),
    role: defaultRole,
    qty: 1,
    shiftDate,
    startTime: "08:00",
    durationHours: minBillableHours,
    notes: "",
  };
}

/**
 * Create a new blank non-labour line.
 */
function emptyNonLabourLine(): NonLabourLine {
  return {
    id: uid("nl"),
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
const [draftName, setDraftName] = useState("Untitled Estimate");
const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
const [selectedDraftId, setSelectedDraftId] = useState("");
const [isMounted, setIsMounted] = useState(false);
const [showStartNewConfirm, setShowStartNewConfirm] = useState(false);
const [preparedBy, setPreparedBy] = useState("");
const [validUntilManuallyEdited, setValidUntilManuallyEdited] = useState(false);

useEffect(() => {
  const stored = localStorage.getItem("loadedEstimateRequest");

  if (!stored) return;

  const loaded = JSON.parse(stored);
  const payload = loaded.payload || loaded;

  setInput((prev) => ({
    ...prev,
    quoteNumber: loaded.requestNumber || prev.quoteNumber || "",
    status: "Draft",
    companyName: payload.companyName || "",
    contactName: payload.customerName || "",
    contactEmail: payload.email || "",
    contactPhone: payload.phone || "",
    venue: payload.eventLocation || "",
    notes: payload.notes || "",
    labour: (payload.crewLines || []).map((line: any) => ({
      id: crypto.randomUUID(),
      role: line.crewType,
      qty: Number(line.qty),
      shiftDate: line.shiftDate,
      startTime: line.startTime,
      durationHours: parseDurationHours(line.duration) ?? 0,
      notes: line.notes,
    })),
  }));

  localStorage.setItem(
    "convertedEstimateRequestId",
    loaded.requestId || ""
  );

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
      .select("is_active, full_name, email")
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
            config.minBillableHours
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
   * Simple busy flag used by toolbar/UI.
   */
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
    return calculateQuoteTotals(nextInput, config);
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
  }, [input, config, ready]);

  /**
   * Original file also includes this second recalculation effect.
   * It directly recalculates result whenever config/input/ready changes.
   * This is preserved exactly to avoid changing behaviour.
   */
  useEffect(() => {
    if (!ready) return;
    setResult(calculateCurrentQuote(input));
  }, [config, input, ready]);

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
   * Remove a labour row by id.
   */
  function removeLabour(id: string) {
    const next = { ...input, labour: input.labour.filter((l) => l.id !== id) };
    recalc(next);
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
        "companyName" | "contactName" | "contactEmail" | "contactPhone" | "venue" | "notes"
      >
    >
  ) {
    const next = { ...input, ...patch };
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
    labour: [emptyLabourLine(config.rates[0]?.role ?? "", config.minBillableHours, todayIso)],
    nonLabour: [emptyNonLabourLine()],
  };

  setDraftName("Untitled Estimate");
  setSelectedDraftId("");
  setInput(freshInput);
  setResult(calculateCurrentQuote(freshInput));
  setDurationText({});
  setStartTimeText({});
}

function handleStartNew() {
  if (
    isQuoteEmpty({
      input,
      draftName,
      minBillableHours: config.minBillableHours,
    })
  ) {
    resetToBlankQuote();
    setValidUntilManuallyEdited(false);
    return;
  }

  setShowStartNewConfirm(true);
}

async function handleSaveAndStartNew() {
  await saveDraft(selectedDraftId || undefined);
  resetToBlankQuote();
  setShowStartNewConfirm(false);
}

function handleDiscardAndStartNew() {
  resetToBlankQuote();
  setShowStartNewConfirm(false);
}

function handleCancelStartNew() {
  setShowStartNewConfirm(false);
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
   * Save a draft.
   * If overwriteId matches an existing draft, update that draft.
   * Otherwise create a new draft.
   */
async function saveDraft(overwriteId?: string) {
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
  labour: (draftInput.labour || []).map((line) => ({
    ...line,
    id: line.id || uid("lab"),
    notes: line.notes || "",
  })),
  nonLabour: (draftInput.nonLabour || []).map((line) => ({
    ...line,
    id: line.id || uid("nl"),
  })),
};

  setDraftName(draft.name || "Untitled Estimate");
  setSelectedDraftId(draft.id);
  setInput(hydrated);
  recalc(hydrated);
  setValidUntilManuallyEdited(!!hydrated.validUntil);
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

  if (selectedDraftId === id) {
    setSelectedDraftId("");
  }

  alert("Saved estimate deleted.");
  await loadAllDrafts();
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
  setSavedDrafts([]); // fail safely instead of stale UI
  return;
}

  const drafts: SavedDraft[] = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    savedAt: row.created_at,
    updatedAt: row.updated_at || null,
    currentVersion: row.current_version ?? 1,
    input: {
      ...defaultInput,
      ...(row.payload || {}),
      quoteNumber: row.payload?.quoteNumber || row.quote_number || "",
      quoteDate: row.payload?.quoteDate || "",
      validUntil: row.payload?.validUntil || "",
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
   * Filter saved drafts using the toolbar search box.
   * Matches quote number, draft name, company name, or contact name.
   */
  const filteredDrafts = savedDrafts.filter((d) => {
    const needle = quoteSearch.trim().toLowerCase();
    if (!needle) return true;

    const quoteNumber = (d.input.quoteNumber ?? "").toLowerCase();
    const draftLabel = (d.name ?? "").toLowerCase();
    const companyName = (d.input.companyName ?? "").toLowerCase();
    const contactName = (d.input.contactName ?? "").toLowerCase();

    return (
      quoteNumber.includes(needle) ||
      draftLabel.includes(needle) ||
      companyName.includes(needle) ||
      contactName.includes(needle)
    );
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
  quoteNumber={input.quoteNumber}
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
/>

      <div className="toolbar-section">
        <DraftToolbar
          draftName={draftName}
          setDraftName={setDraftName}
          quoteSearch={quoteSearch}
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
          onLoadSelected={() => selectedDraftId && loadDraftById(selectedDraftId)}
          onDeleteSelected={() => selectedDraftId && deleteDraft(selectedDraftId)}
          onClearAll={handleStartNew}
          onPrint={() => window.print()}
          onRecalculate={() => recalc(input)}
          onDownloadPdf={downloadQuotePdf}
          busy={busy}
        />
      </div>
      
     <div className="no-print" style={{ marginBottom: "12px" }}>
  <label style={{ display: "grid", gap: "4px", maxWidth: "200px" }}>
    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
      Status
    </span>
    <select
      value={input.status || "Draft"}
      onChange={(e) =>
        setInput((prev) => ({
          ...prev,
          status: e.target.value as "Draft" | "Sent" | "Approved",
        }))
      }
      style={{
        padding: "8px 10px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.2)",
      }}
    >
      <option value="Draft">Draft</option>
      <option value="Sent">Sent</option>
      <option value="Approved">Approved</option>
    </select>
  </label>
</div>
      
      <div
  style={{
    marginTop: "8px",
    marginBottom: "12px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.65)",
  }}
>
  {selectedDraftMeta
    ? `Version ${selectedDraftMeta.currentVersion ?? 1} · Last saved ${formatSavedDate(
        selectedDraftMeta.updatedAt || selectedDraftMeta.savedAt
      )}`
    : "New unsaved estimate"}
</div>

      <div className="hr" />

      <ClientDetailsCard input={input} onUpdateHeader={updateHeader} />

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
    duplicateLabour={duplicateLabour}
    removeLabour={removeLabour}
    sortLabourByDate={sortLabourByDate}
    formatDateDDMMYYYY={formatDateDDMMYYYY}
    normaliseHHMM={normaliseHHMM}
    hoursToHHMM={hoursToHHMM}
    autoColonHHMM={autoColonHHMM}
    money={moneyFmt}
    minBillableHours={config.minBillableHours}
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

      <div className="quote-end-spacer" />
    </div>
  );
}
