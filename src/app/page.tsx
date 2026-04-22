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
import { supabase } from "@/src/lib/supabase";


/**
 * React hooks
 */
import { useEffect, useMemo, useState } from "react";



/**
 * Quote calculation engine and app configuration hook
 */
import { estimateQuote } from "@/src/lib/calc";
import { useAppConfig } from "@/src/lib/useAppConfig";

/**
 * Shared app types
 */
import type {
  QuoteInput,
  LabourLine,
  NonLabourLine,
  QuoteResult,
} from "@/src/lib/types";

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




/**
 * Generate the quote number.
 * Example: GP-12345
 */
async function generateQuoteNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_quote_number");

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
  labour: [emptyLabourLine("", 4, "")],
  nonLabour: [emptyNonLabourLine()],
};

/**
 * Main page component.
 */
export default function Page() {
  

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

useEffect(() => {
  setIsMounted(true);
  loadAllDrafts();
}, []);

 function ddmmyyyyToIso(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

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

const valid = new Date();
valid.setDate(today.getDate() + 14);

  

  setInput((prev) => ({
    ...prev,
    quoteNumber: prev.quoteNumber || "",
    quoteDate: prev.quoteDate || formatDateDDMMYYYY(today),
    validUntil: prev.validUntil || formatDateDDMMYYYY(valid),
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
    const normalised = ready ? normaliseInputRoles(next) : next;
    setInput(normalised);
  }

  /**
   * When config changes, make sure all labour rows still reference valid configured roles.
   */
  useEffect(() => {
    if (!ready) return;

    setInput((prev) => normaliseInputRoles(prev));
  }, [ready, config]);

  /**
   * Recalculate quote whenever input or config changes.
   * Also toggles the busy flag around the calculation.
   */
  useEffect(() => {
    if (!ready) return;

    setBusy(true);
    try {
      setResult(estimateQuote(input, config));
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
    setResult(estimateQuote(input, config));
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
    const sorted = [...input.labour].sort((a, b) => {
      const dateA = a.shiftDate || "";
      const dateB = b.shiftDate || "";

      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const timeA = normaliseHHMM(a.startTime) ?? a.startTime ?? "";
      const timeB = normaliseHHMM(b.startTime) ?? b.startTime ?? "";

      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }

      return a.role.localeCompare(b.role);
    });

    const next = { ...input, labour: sorted };
    recalc(next);
  }

  /**
   * Ensure all labour roles are still valid against the current config.
   * If a role is no longer valid, fall back to the first configured role.
   */
  function normaliseInputRoles(next: QuoteInput): QuoteInput {
    const validRoles = config.rates.map((r) => r.role);
    const fallbackRole = validRoles[0] ?? "";

    return {
      ...next,
      labour: next.labour.map((line) => ({
        ...line,
        role: validRoles.includes(line.role) ? line.role : fallbackRole,
      })),
    };
  }

  /**
   * Convert decimal hours into HH:MM format.
   * Example: 4.5 -> 04:30
   */
  function hoursToHHMM(hours: number): string {
    if (!Number.isFinite(hours)) return "00:00";
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /**
   * Automatically insert a colon while the user types time values.
   * Example: 0830 -> 08:30
   */
  function autoColonHHMM(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  /**
   * Convert HH:MM text into decimal hours.
   * Example: 04:30 -> 4.5
   */
  function hhmmToHours(value: string): number {
    const match = value.match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match) return 0;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h + m / 60;
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
  
  function isQuoteEmpty() {
  const hasHeaderData =
    (input.companyName || "").trim() !== "" ||
    (input.contactName || "").trim() !== "" ||
    (input.contactEmail || "").trim() !== "" ||
    (input.contactPhone || "").trim() !== "" ||
    (input.venue || "").trim() !== "" ||
    (input.notes || "").trim() !== "" ||
    (draftName || "").trim() !== "" && draftName !== "Untitled Estimate";

  const hasLabourData = input.labour.some(
    (line) =>
      (line.role || "").trim() !== "" ||
      (line.notes || "").trim() !== "" ||
      (line.qty ?? 1) !== 1 ||
      (line.startTime || "") !== "08:00" ||
      (line.durationHours ?? config.minBillableHours) !== config.minBillableHours ||
      (line.shiftDate || "").trim() !== ""
  );

  const hasNonLabourData = input.nonLabour.some(
    (line) =>
      (line.description || "").trim() !== "" ||
      (line.amountExGst ?? 0) !== 0 ||
      (line.qty ?? 1) !== 1
  );

  return !hasHeaderData && !hasLabourData && !hasNonLabourData;
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
  setResult(estimateQuote(freshInput, config));
  setDurationText({});
  setStartTimeText({});
}

function handleStartNew() {
  if (isQuoteEmpty()) {
    resetToBlankQuote();
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

  /**
   * Save a draft.
   * If overwriteId matches an existing draft, update that draft.
   * Otherwise create a new draft.
   */
async function saveDraft(overwriteId?: string) {
  const now = new Date().toISOString();
  const actor = "admin"; // Replace later with actual logged-in user if auth is added
  const name = (draftName || "Untitled Estimate").trim();

  const quoteNumber = overwriteId
    ? input.quoteNumber || await generateQuoteNumber()
    : await generateQuoteNumber();

  const ensuredInput: QuoteInput = {
    ...input,
    quoteNumber,
    quoteDate: input.quoteDate || formatDateDDMMYYYY(new Date()),
    validUntil: input.validUntil || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return formatDateDDMMYYYY(d);
    })(),
  };

  // Update an existing quote and create a new history version
  if (overwriteId) {
    const { data: existingQuote, error: fetchError } = await supabase
      .from("quotes")
      .select("id, current_version")
      .eq("id", overwriteId)
      .single();

    if (fetchError) {
      alert("Error loading existing estimate version: " + fetchError.message);
      return;
    }

    const nextVersion = (existingQuote?.current_version || 1) + 1;

    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        name,
        quote_number: ensuredInput.quoteNumber,
        quote_date: ddmmyyyyToIso(ensuredInput.quoteDate),
        valid_until: ddmmyyyyToIso(ensuredInput.validUntil),
        payload: ensuredInput,
        updated_at: now,
        updated_by: actor,
        current_version: nextVersion,
      })
      .eq("id", overwriteId);

    if (updateError) {
      alert("Error updating estimate: " + updateError.message);
      return;
    }

    const { error: versionError } = await supabase
      .from("quote_versions")
      .insert([
        {
          quote_id: overwriteId,
          version_number: nextVersion,
          saved_at: now,
          saved_by: actor,
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
  const { data: insertedQuote, error: insertError } = await supabase
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
        created_by: actor,
        updated_by: actor,
        current_version: 1,
        is_deleted: false,
      },
    ])
    .select("id")
    .single();

    if (insertError) {
      alert("Error saving estimate: " + insertError.message);
      return;
    }

    const { error: versionError } = await supabase
      .from("quote_versions")
      .insert([
        {
          quote_id: insertedQuote.id,
          version_number: 1,
          saved_at: now,
          saved_by: actor,
          input: ensuredInput,
          change_summary: "Initial version",
        },
      ]);

    if (versionError) {
      alert("Estimate saved, but failed to write version history: " + versionError.message);
      return;
    }

    setInput(ensuredInput);
    setSelectedDraftId(insertedQuote.id);
    alert("Estimate saved (shared across users). Version 1 created.");
    await loadAllDrafts();
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

  const hydrated: QuoteInput = {
  ...draft.input,
  quoteNumber: draft.input.quoteNumber || "",
  quoteDate: draft.input.quoteDate || formatDateDDMMYYYY(new Date()),
  validUntil: draft.input.validUntil || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return formatDateDDMMYYYY(d);
  })(),
  labour: (draft.input.labour || []).map((line) => ({
    ...line,
    id: line.id || uid("lab"),
    notes: line.notes || "",
  })),
  nonLabour: (draft.input.nonLabour || []).map((line) => ({
    ...line,
    id: line.id || uid("nl"),
  })),
};

  setDraftName(draft.name || "Untitled Estimate");
  setSelectedDraftId(draft.id);
  setInput(hydrated);
  recalc(hydrated);
}

  /**
   * Delete one saved draft by id.
   */
  async function deleteDraft(id: string) {
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Error deleting estimate: " + error.message);
    return;
  }

  if (selectedDraftId === id) {
    setSelectedDraftId("");
  }

  alert("Saved estimate deleted.");
  loadAllDrafts();
}

  /**
   * Clear all saved drafts from localStorage.
   */
  async function clearAllDrafts() {
  const { error } = await supabase
    .from("quotes")
    .delete()
    .not("id", "is", null);

  if (error) {
    alert("Error clearing estimates: " + error.message);
    return;
  }

  setSavedDrafts([]);
  setSelectedDraftId("");
  alert("All saved estimates cleared.");
}

  /**
   * Validate and normalise a HH:MM string.
   * Returns null if invalid.
   */
  function normaliseHHMM(value: string): string | null {
    const raw = value.trim();
    const m = raw.match(/^(\d{1,2}):([0-5]\d)$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mins = Number(m[2]);
    if (!Number.isFinite(h) || h < 0 || h > 23) return null;
    return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  /**
   * Format a Date object as DD/MM/YYYY.
   */
  function formatDateDDMMYYYY(date: Date): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const drafts: SavedDraft[] = (data || []).map((row: any) => ({
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
  version={selectedDraftMeta?.currentVersion ?? 1}
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
          busy={busy}
        />
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