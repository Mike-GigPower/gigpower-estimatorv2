"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppConfig, RateRow } from "@/src/lib/types";
import {
  RATE_EFFECTIVE_FROM_SENTINEL,
  STANDARD_SET_CODE,
  STANDARD_SET_ID,
} from "@/src/lib/types";
import { RATE_CARD_COLUMNS, mapRateCardRow } from "@/src/lib/rateCards";
import { createClient } from "@/src/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

type AuditEntry = {
  changeType: string;
  targetKey: string;
  beforeValue: unknown;
  afterValue: unknown;
};

type RateScheduleProps = {
  config: AppConfig;
  updateConfig: (next: AppConfig) => void;
  authClient: SupabaseBrowserClient;
  writeAuditLog: (entry: AuditEntry) => Promise<void>;
  numberInputClass: string;
  sectionTitleClass: string;
  mobileRateLabelClass: string;
};

// The editable numeric fields, in display order. `blank` is what an empty
// value means, for fields that may be left blank (saved as null, never 0).
const RATE_FIELDS: { key: RateFieldKey; label: string; blank?: string }[] = [
  { key: "day", label: "Day" },
  { key: "night", label: "Night" },
  { key: "sunday", label: "Sunday" },
  { key: "publicHoliday", label: "Public Holiday" },
  { key: "over8", label: "Over 8 hrs (blank = no tier)", blank: "No tier" },
  { key: "over10", label: "Over 10 hrs (blank = no tier)", blank: "No tier" },
  { key: "minBillableHours", label: "Minimum (h) (blank = global)", blank: "Global" },
];

// A card set from rate_card_sets, for the picker and for set_id on writes.
type RateCardSet = { id: string; code: string; name: string; kind: string };

// Shown if rate_card_sets can't be read, so Standard stays editable.
const STANDARD_SET: RateCardSet = {
  id: STANDARD_SET_ID,
  code: STANDARD_SET_CODE,
  name: "Standard",
  kind: "standard",
};

type RateFieldKey =
  | "day"
  | "night"
  | "sunday"
  | "publicHoliday"
  | "over8"
  | "over10"
  | "minBillableHours";
type RateFieldStrings = Record<RateFieldKey, string>;

// ---- small helpers -------------------------------------------------------

const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// Overtime tiers: blank saves as null ("no tier"), never 0.
const numOrNull = (v: string) => (v.trim() === "" ? null : num(v));
// null displays as blank (no tier); undefined (an unset draft) as 0.
const fmtNum = (n: number | null | undefined) => (n === null ? "" : String(n ?? 0));
// Per-role minimum: blank (null or unset) means the global setting.
const fmtMin = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const isSentinel = (iso?: string) => iso === RATE_EFFECTIVE_FROM_SENTINEL;

// Today as a local YYYY-MM-DD string (NOT toISOString, which is UTC and can be
// a day off in Australian timezones).
function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// YYYY-MM-DD -> DD/MM/YYYY by string parsing (same rule as formatAuDate).
function formatAu(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function toFieldStrings(r: Partial<RateRow>): RateFieldStrings {
  return {
    day: fmtNum(r.day),
    night: fmtNum(r.night),
    sunday: fmtNum(r.sunday),
    publicHoliday: fmtNum(r.publicHoliday),
    over8: fmtNum(r.over8),
    over10: fmtNum(r.over10),
    minBillableHours: fmtMin(r.minBillableHours),
  };
}

const vkey = (role: string, effectiveFrom: string) => `${role}::${effectiveFrom}`;

// ---- component -----------------------------------------------------------

export default function RateSchedule({
  config,
  updateConfig,
  authClient,
  writeAuditLog,
  numberInputClass,
  sectionTitleClass,
  mobileRateLabelClass,
}: RateScheduleProps) {
  const today = localTodayISO();

  // Per-field edit overrides for existing/base versions, keyed by vkey.
  const [edits, setEdits] = useState<Record<string, RateFieldStrings>>({});
  // The open "schedule a change" form (one at a time), or null.
  const [schedule, setSchedule] = useState<{
    role: string;
    date: string;
    fields: RateFieldStrings;
  } | null>(null);
  // The open "add role" draft, or null.
  const [newRole, setNewRole] = useState<{ role: string; fields: RateFieldStrings } | null>(
    null
  );
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // Card sets for the picker. The schedule shows one set at a time.
  const [sets, setSets] = useState<RateCardSet[]>([STANDARD_SET]);
  const [selectedSetCode, setSelectedSetCode] = useState(STANDARD_SET_CODE);
  const selectedSet = sets.find((x) => x.code === selectedSetCode) ?? STANDARD_SET;
  const isCustomerSet = selectedSet.kind === "customer";

  useEffect(() => {
    async function loadSets() {
      const { data, error } = await authClient
        .from("rate_card_sets")
        .select("id, code, name, kind")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("Failed to load rate card sets:", error);
        return;
      }
      if (data && data.length) setSets(data as RateCardSet[]);
    }
    loadSets();
  }, [authClient]);

  // Group the chosen set's rates by role and classify each role's versions.
  const roles = useMemo(() => {
    const map = new Map<string, RateRow[]>();
    for (const r of config.rates) {
      if (r.setCode !== selectedSetCode) continue;
      if (!map.has(r.role)) map.set(r.role, []);
      map.get(r.role)!.push(r);
    }

    const out = Array.from(map.entries()).map(([role, versions]) => {
      const sorted = [...versions].sort((a, b) =>
        (a.effectiveFrom || "").localeCompare(b.effectiveFrom || "")
      );
      const inEffect = sorted.filter((v) => (v.effectiveFrom || "") <= today);
      const current = inEffect.length ? inEffect[inEffect.length - 1] : sorted[0];
      const scheduled = sorted.filter((v) => (v.effectiveFrom || "") > today);
      const past = inEffect.filter((v) => v !== current);
      const base = sorted.find((v) => isSentinel(v.effectiveFrom)) || sorted[0];
      return { role, sorted, current, scheduled, past, base, sortOrder: base?.sortOrder ?? 0 };
    });

    // config.rates already arrives ordered by sort_order; this keeps roles
    // in that order regardless of Map iteration quirks.
    out.sort((a, b) => a.sortOrder - b.sortOrder);
    return out;
  }, [config.rates, today, selectedSetCode]);

  // Re-fetch rate_cards (all active sets) from Supabase and push into config
  // so the UI (and the estimator on its next load) reflect the change.
  // Mirrors the useAppConfig loader query.
  async function reloadRates() {
    const { data, error } = await authClient
      .from("rate_cards")
      .select(`${RATE_CARD_COLUMNS}, rate_card_sets!inner(code, is_active)`)
      .eq("is_active", true)
      .eq("rate_card_sets.is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      alert("Failed to reload rates: " + error.message);
      return;
    }

    const mapped: RateRow[] = (data || []).map((row: any) =>
      mapRateCardRow(row, row.rate_card_sets.code)
    );

    updateConfig({ ...config, rates: mapped });
  }

  // Read the current editable value for a field: an in-progress edit if any,
  // otherwise the stored version value.
  function fieldValue(key: string, version: RateRow, field: RateFieldKey): string {
    return edits[key]?.[field] ?? toFieldStrings(version)[field];
  }

  function setFieldValue(
    key: string,
    version: RateRow,
    field: RateFieldKey,
    value: string
  ) {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? toFieldStrings(version)), [field]: value },
    }));
  }

  function gatherFields(key: string, version: RateRow): RateFieldStrings {
    return {
      day: fieldValue(key, version, "day"),
      night: fieldValue(key, version, "night"),
      sunday: fieldValue(key, version, "sunday"),
      publicHoliday: fieldValue(key, version, "publicHoliday"),
      over8: fieldValue(key, version, "over8"),
      over10: fieldValue(key, version, "over10"),
      minBillableHours: fieldValue(key, version, "minBillableHours"),
    };
  }

  // Insert or update one version (one row per role + effective_from) in the
  // chosen set. Role names are unique across sets, so the conflict target
  // stays role_name,effective_from.
  async function persistVersion(
    role: string,
    effectiveFrom: string,
    fields: RateFieldStrings,
    sortOrder: number
  ): Promise<boolean> {
    // Blank = the global minimum, saved as null. Never 0 (the column rejects it).
    const minBillableHours = numOrNull(fields.minBillableHours);
    if (minBillableHours !== null && !(minBillableHours > 0)) {
      alert("Minimum (h) must be more than 0, or blank to use the global minimum.");
      return false;
    }

    setBusy(true);

    const { data: before } = await authClient
      .from("rate_cards")
      .select("*")
      .eq("set_id", selectedSet.id)
      .eq("role_name", role)
      .eq("effective_from", effectiveFrom)
      .maybeSingle();

    const rateObj = {
      day: num(fields.day),
      night: num(fields.night),
      sunday: num(fields.sunday),
      publicHoliday: num(fields.publicHoliday),
      over8: numOrNull(fields.over8),
      over10: numOrNull(fields.over10),
      minBillableHours,
      // Standard rows use the code map, so they never carry call_names. A
      // customer row's only call name is its own role name, which is what
      // the quote's line dropdown offers on that card.
      callNames: isCustomerSet ? [role] : [],
    };

    const { error } = await authClient.from("rate_cards").upsert(
      {
        role_name: role,
        category: "standard",
        day_rate: rateObj.day,
        night_rate: rateObj.night,
        sunday_rate: rateObj.sunday,
        public_holiday_rate: rateObj.publicHoliday,
        ot_8_day_rate: rateObj.over8,
        ot_8_night_rate: rateObj.over8,
        ot_10_day_rate: rateObj.over10,
        ot_10_night_rate: rateObj.over10,
        sort_order: sortOrder,
        is_active: true,
        effective_from: effectiveFrom,
        set_id: selectedSet.id,
        call_names: rateObj.callNames,
        min_billable_hours: rateObj.minBillableHours,
      },
      { onConflict: "role_name,effective_from" }
    );

    setBusy(false);

    if (error) {
      alert("Error saving rate: " + error.message);
      return false;
    }

    await writeAuditLog({
      changeType: "rate_card",
      targetKey: `${selectedSet.code} / ${role} @ ${effectiveFrom}`,
      beforeValue: before,
      afterValue: rateObj,
    });
    await reloadRates();
    return true;
  }

  async function saveExistingVersion(role: string, version: RateRow) {
    const key = vkey(role, version.effectiveFrom || RATE_EFFECTIVE_FROM_SENTINEL);
    const ok = await persistVersion(
      role,
      version.effectiveFrom || RATE_EFFECTIVE_FROM_SENTINEL,
      gatherFields(key, version),
      version.sortOrder ?? 0
    );
    if (ok) {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  // Cancel a scheduled (future) version. Soft-delete so we keep an audit trail;
  // the loader only reads is_active = true, so it disappears from pricing.
  async function cancelScheduledVersion(role: string, effectiveFrom: string) {
    if (
      !confirm(
        `Cancel the scheduled rate change for "${role}" effective ${formatAu(
          effectiveFrom
        )}?`
      )
    )
      return;

    setBusy(true);
    const { data: before } = await authClient
      .from("rate_cards")
      .select("*")
      .eq("set_id", selectedSet.id)
      .eq("role_name", role)
      .eq("effective_from", effectiveFrom)
      .maybeSingle();

    const { error } = await authClient
      .from("rate_cards")
      .update({ is_active: false })
      .eq("set_id", selectedSet.id)
      .eq("role_name", role)
      .eq("effective_from", effectiveFrom);
    setBusy(false);

    if (error) {
      alert("Error cancelling change: " + error.message);
      return;
    }
    await writeAuditLog({
      changeType: "rate_card_delete",
      targetKey: `${selectedSet.code} / ${role} @ ${effectiveFrom}`,
      beforeValue: before,
      afterValue: null,
    });
    await reloadRates();
  }

  // Retire an entire role (all its versions). Existing quotes already priced
  // keep their numbers; new quotes can no longer select this role.
  async function removeRole(role: string) {
    if (
      !confirm(
        `Remove the role "${role}" and all of its rate versions?\n\n` +
          `Quotes already priced keep their numbers, but new quotes will no ` +
          `longer be able to use this role.`
      )
    )
      return;

    setBusy(true);
    const { error } = await authClient
      .from("rate_cards")
      .update({ is_active: false })
      .eq("set_id", selectedSet.id)
      .eq("role_name", role);
    setBusy(false);

    if (error) {
      alert("Error removing role: " + error.message);
      return;
    }
    await writeAuditLog({
      changeType: "rate_card_delete",
      targetKey: `${selectedSet.code} / ${role}`,
      beforeValue: { role },
      afterValue: { is_active: false },
    });
    await reloadRates();
  }

  // ---- schedule-change form ----------------------------------------------

  function openSchedule(role: string, current: RateRow) {
    setSchedule({
      role,
      date: "",
      fields: toFieldStrings(current),
    });
  }

  async function saveSchedule() {
    if (!schedule) return;
    const { role, date, fields } = schedule;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert("Pick an effective-from date for the rate change.");
      return;
    }
    if (date <= today) {
      alert("A scheduled rate change must take effect on a future date.");
      return;
    }
    const roleGroup = roles.find((r) => r.role === role);
    const clash = roleGroup?.sorted.some((v) => (v.effectiveFrom || "") === date);
    if (clash) {
      alert(
        `There is already a rate version for "${role}" effective ${formatAu(
          date
        )}. Edit that one instead.`
      );
      return;
    }

    const sortOrder = roleGroup?.base?.sortOrder ?? 0;
    const ok = await persistVersion(role, date, fields, sortOrder);
    if (ok) setSchedule(null);
  }

  // ---- add-role form ------------------------------------------------------

  function openNewRole() {
    // Customer cards state their overtime tiers; start them blank (no tier).
    const ot = isCustomerSet ? "" : "0";
    setNewRole({
      role: "",
      fields: {
        day: "0",
        night: "0",
        sunday: "0",
        publicHoliday: "0",
        over8: ot,
        over10: ot,
        minBillableHours: "",
      },
    });
  }

  async function saveNewRole() {
    if (!newRole) return;
    const role = newRole.role.trim();
    if (!role) {
      alert("Enter a role name.");
      return;
    }
    // Role names are unique across every card (the upsert's conflict target
    // is role_name,effective_from), so check all sets, not just this one.
    const exists = config.rates.some((r) => r.role.toLowerCase() === role.toLowerCase());
    if (exists) {
      alert(`A role named "${role}" already exists.`);
      return;
    }
    const nextSortOrder = (roles.length + 1) * 10;
    const ok = await persistVersion(
      role,
      RATE_EFFECTIVE_FROM_SENTINEL,
      newRole.fields,
      nextSortOrder
    );
    if (ok) setNewRole(null);
  }

  // ---- shared styles ------------------------------------------------------

  const amberBtn =
    "shrink-0 rounded-lg bg-amber-500 px-4 py-2 font-medium text-black transition hover:bg-amber-400 disabled:opacity-50";
  const ghostBtn =
    "rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-amber-400/60 disabled:opacity-50";
  const cardClass = "rounded-xl border border-white/10 bg-white/5 p-4 space-y-3";
  const gridClass = "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3";

  // Render the editable number inputs for a version.
  function rateInputs(role: string, version: RateRow) {
    const key = vkey(role, version.effectiveFrom || RATE_EFFECTIVE_FROM_SENTINEL);
    return (
      <div className={gridClass}>
        {RATE_FIELDS.map(({ key: fk, label, blank }) => (
          <div key={fk}>
            <label className={mobileRateLabelClass}>{label}</label>
            <input
              type="number"
              step="0.01"
              className={numberInputClass}
              value={fieldValue(key, version, fk)}
              placeholder={blank}
              onChange={(e) => setFieldValue(key, version, fk, e.target.value)}
            />
          </div>
        ))}
      </div>
    );
  }

  // Render the read-only values for a past version.
  function readOnlyRates(version: RateRow) {
    return (
      <div className={gridClass}>
        {RATE_FIELDS.map(({ key: fk, label, blank }) => (
          <div key={fk}>
            <label className={mobileRateLabelClass}>{label}</label>
            <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-white/60">
              {toFieldStrings(version)[fk] === "" ? blank : toFieldStrings(version)[fk]}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render the inputs for a draft (schedule / new-role) form.
  function draftInputs(
    fields: RateFieldStrings,
    onChange: (field: RateFieldKey, value: string) => void
  ) {
    return (
      <div className={gridClass}>
        {RATE_FIELDS.map(({ key: fk, label, blank }) => (
          <div key={fk}>
            <label className={mobileRateLabelClass}>{label}</label>
            <input
              type="number"
              step="0.01"
              className={numberInputClass}
              value={fields[fk]}
              placeholder={blank}
              onChange={(e) => onChange(fk, e.target.value)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="admin-card">
      <div className="flex items-start justify-between gap-4 px-1 md:px-2 admin-action-row">
        <div className="space-y-2 px-1">
          <h2 className={sectionTitleClass}>Rates</h2>
          <p className="text-sm text-white/55">
            Each role has a base rate plus any dated changes. A labour line is
            priced using the rate in effect on its shift date.
          </p>
          <p className="text-xs text-white/45">
            To change a rate, schedule it from a future date rather than editing
            the current one — that keeps quotes for earlier jobs on the old rate.
          </p>
          <label className="flex items-center gap-2 text-sm text-white/70">
            Card
            <select
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-amber-400"
              value={selectedSetCode}
              disabled={busy}
              onChange={(e) => {
                setSelectedSetCode(e.target.value);
                setSchedule(null);
                setNewRole(null);
              }}
            >
              {sets.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button onClick={openNewRole} className={amberBtn} disabled={busy}>
          Add Role
        </button>
      </div>

      {/* Add-role draft */}
      {newRole && (
        <div className={`${cardClass} mx-1 md:mx-2 mt-4 border-amber-400/40`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-amber-300">New role</span>
            <input
              className="flex-1 min-w-[180px] rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-bold text-white placeholder-slate-400 outline-none focus:border-amber-400"
              placeholder="Role name"
              value={newRole.role}
              onChange={(e) => setNewRole({ ...newRole, role: e.target.value })}
            />
          </div>
          {draftInputs(newRole.fields, (field, value) =>
            setNewRole({ ...newRole, fields: { ...newRole.fields, [field]: value } })
          )}
          <div className="flex gap-2">
            <button onClick={saveNewRole} className={amberBtn} disabled={busy}>
              Save role
            </button>
            <button onClick={() => setNewRole(null)} className={ghostBtn} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 px-1 md:px-2 mt-4">
        {roles.length === 0 && (
          <p className="text-sm text-white/50">No roles yet. Add one to get started.</p>
        )}

        {roles.map(({ role, current, scheduled, past, base }) => {
          const currentIsBase = isSentinel(current.effectiveFrom);
           const scheduling = schedule?.role === role;
          return (
            <div
              key={role}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4"
            >
              {/* Role header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{role}</h3>
                  <p className="text-xs text-white/45">
                    {currentIsBase
                      ? "Base rate"
                      : `In effect since ${formatAu(current.effectiveFrom)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openSchedule(role, current)}
                    className={ghostBtn}
                    disabled={busy || (schedule?.role === role)}
                  >
                    Schedule rate change
                  </button>
                  <button
                    onClick={() => removeRole(role)}
                    className="admin-danger-btn"
                    disabled={busy}
                  >
                    Remove role
                  </button>
                </div>
              </div>

              {/* Current / base editable version */}
              <div
                className={cardClass}
                style={scheduling ? { opacity: 0.4, pointerEvents: "none" } : undefined}
              >
                <div className="text-xs uppercase tracking-wide text-white/45">
                  {currentIsBase ? "Base rate" : `Current — from ${formatAu(current.effectiveFrom)}`}
                </div>
                {rateInputs(role, current)}
                <button
                  onClick={() => saveExistingVersion(role, current)}
                  className={amberBtn}
                  disabled={busy}
                >
                  Save
                </button>
              </div>

              {/* Scheduled (future) versions */}
              {scheduled.map((v) => (
                <div key={v.effectiveFrom} className={`${cardClass} border-amber-400/30`}>
                  <div className="text-xs uppercase tracking-wide text-amber-300">
                    Scheduled — from {formatAu(v.effectiveFrom)}
                  </div>
                  {rateInputs(role, v)}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveExistingVersion(role, v)}
                      className={amberBtn}
                      disabled={busy}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => cancelScheduledVersion(role, v.effectiveFrom || "")}
                      className="admin-danger-btn"
                      disabled={busy}
                    >
                      Cancel change
                    </button>
                  </div>
                </div>
              ))}

              {/* Schedule-change form for this role */}
              {schedule?.role === role && (
                <div className={`${cardClass} border-amber-400/40`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-amber-300">
                      New rate change
                    </span>
                    <label className="text-xs text-white/55">Effective from</label>
                    <input
                      type="date"
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none focus:border-amber-400"
                      value={schedule.date}
                      min={today}
                      onChange={(e) => setSchedule({ ...schedule, date: e.target.value })}
                    />
                  </div>
                  {draftInputs(schedule.fields, (field, value) =>
                    setSchedule({
                      ...schedule,
                      fields: { ...schedule.fields, [field]: value },
                    })
                  )}
                  <div className="flex gap-2">
                    <button onClick={saveSchedule} className={amberBtn} disabled={busy}>
                      Save change
                    </button>
                    <button
                      onClick={() => setSchedule(null)}
                      className={ghostBtn}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* History (past, superseded versions) — read only */}
              {past.length > 0 && (
                <div>
                  <button
                    onClick={() =>
                      setHistoryOpen((prev) => ({ ...prev, [role]: !prev[role] }))
                    }
                    className="text-xs text-white/50 underline hover:text-white/80"
                  >
                    {historyOpen[role]
                      ? "Hide history"
                      : `Show history (${past.length})`}
                  </button>

                  {historyOpen[role] && (
                    <div className="mt-3 space-y-3">
                      {[...past].reverse().map((v) => (
                        <div
                          key={v.effectiveFrom}
                          className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-3 opacity-80"
                        >
                          <div className="text-xs uppercase tracking-wide text-white/40">
                            {isSentinel(v.effectiveFrom)
                              ? "Previous base rate"
                              : `Was in effect from ${formatAu(v.effectiveFrom)}`}
                          </div>
                          {readOnlyRates(v)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
