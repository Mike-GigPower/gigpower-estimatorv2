"use client";

import { useAppConfig } from "@/src/lib/useAppConfig";
import type { RateRow } from "@/src/lib/estimator";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseData } from "@/src/lib/supabase";
import { createClient } from "@/src/lib/supabase/client";


export default function AdminPage() {
  const { config, updateConfig, restoreDefaults, ready } = useAppConfig();
    const router = useRouter();
  const [authClient] = useState(() => createClient());
const [users, setUsers] = useState<any[]>([]);
const [currentUserId, setCurrentUserId] = useState("");
const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showClearQuotesConfirm, setShowClearQuotesConfirm] = useState(false);
  const [showFinalClearQuotesConfirm, setShowFinalClearQuotesConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [quoteCount, setQuoteCount] = useState<number>(0);
  
    useEffect(() => {
  let isActive = true;

  async function checkAccess() {
    const { data, error } = await authClient.auth.getUser();

    if (!isActive) return;

    if (error || !data.user) {
      router.replace("/login");
      return;
    }

    const user = data.user;
    setCurrentUserId(user.id);

    const { data: profile, error: profileError } = await authClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!isActive) return;

    if (profileError || !profile?.is_active) {
      router.replace("/login");
      return;
    }

    if (profile.role !== "admin") {
      router.replace("/");
      return;
    }

    setIsAdmin(true);
    setIsCheckingAccess(false);
    await loadUsers();
  }

  checkAccess();

  return () => {
    isActive = false;
  };
}, [router, authClient]);

async function loadUsers() {
  const { data, error } = await authClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .order("email", { ascending: true });

  console.log("loadUsers result:", { data, error });

  if (error) {
    console.error("Error loading users:", error);
    alert("Error loading users: " + error.message);
    return;
  }

  setUsers(data || []);
}

async function updateUserProfile(
  userId: string,
  patch: Partial<{
    full_name: string;
    role: string;
    is_active: boolean;
  }>
) {
  if (userId === currentUserId && patch.is_active === false) {
    alert("You cannot deactivate your own account.");
    return;
  }

  if (userId === currentUserId && patch.role && patch.role !== "admin") {
    alert("You cannot remove your own admin access.");
    return;
  }

  const { error } = await authClient
    .from("profiles")
    .update(patch)
    .eq("id", userId);

  if (error) {
    console.error("Error updating user:", error);
    alert("Error updating user: " + error.message);
    return;
  }

  await loadUsers();
}

    if (!ready || isCheckingAccess) {
    return <main className="max-w-5xl mx-auto px-6 py-8">Loading...</main>;
  }

  if (!isAdmin) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Access denied</h1>
        <p>You do not have permission to view this page.</p>
      </main>
    );
  }
  
  // --- Begin Clear All Quotes flow ---
async function handleBeginClearAllQuotes() {
  await fetchQuoteCount(); // get fresh count from Supabase
  setShowClearQuotesConfirm(true);
}

function handleCancelClearAllQuotes() {
  setShowClearQuotesConfirm(false);
  setShowFinalClearQuotesConfirm(false);
  setClearConfirmText("");
}

function handleContinueClearAllQuotes() {
  setShowClearQuotesConfirm(false);
  setShowFinalClearQuotesConfirm(true);
}

/**
 * Final confirmation handler for clearing all saved quotes.
 * Requires the admin to type DELETE before proceeding.
 */
async function handleConfirmClearAllQuotes() {
  if (clearConfirmText !== "DELETE") {
    alert("Please type DELETE to confirm.");
    return;
  }

  await clearAllSavedQuotes();

  // Reset local admin UI state after successful deletion.
  setQuoteCount(0);
  setClearConfirmText("");
  setShowFinalClearQuotesConfirm(false);
  setShowClearQuotesConfirm(false);

  alert("All saved quotes have been removed.");
}
  
  async function fetchQuoteCount() {
  try {
    const { count, error } = await supabaseData
      .from("quotes")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    setQuoteCount(count || 0);
  } catch (err) {
    console.error("Failed to fetch quote count", err);
  }
}


  
  // Admin-only destructive action.
// This deletes all saved quotes from the connected Supabase environment.
// Be careful: local testing will affect whichever Supabase project your env points to.
async function clearAllSavedQuotes() {
  try {
    const { error } = await supabaseData
      .from("quotes")
      .delete()
      .neq("id", "");

    if (error) throw error;
  } catch (err) {
    console.error("Failed to clear saved quotes", err);
    alert("Failed to clear saved quotes.");
    throw err;
  }
}
  
  async function saveRateToSupabase(rate: RateRow, index: number) {
  if (!rate.role.trim()) return;

  const roleName = rate.role.trim();

  const { data: beforeRate } = await authClient
    .from("rate_cards")
    .select("*")
    .eq("role_name", roleName)
    .maybeSingle();

  const { error } = await authClient
    .from("rate_cards")
    .upsert(
      {
        role_name: roleName,
        category: "standard",
        day_rate: rate.day,
        night_rate: rate.night,
        sunday_rate: rate.sunday,
        public_holiday_rate: rate.publicHoliday,
        ot_8_day_rate: rate.over8,
        ot_8_night_rate: rate.over8,
        ot_10_day_rate: rate.over10,
        ot_10_night_rate: rate.over10,
        sort_order: (index + 1) * 10,
        is_active: true,
      },
      { onConflict: "role_name" }
    );

  if (error) {
    console.error("Error saving rate card:", error);
    alert("Error saving rate card: " + error.message);
    return;
  }

  await writeConfigAuditLog({
    changeType: "rate_card",
    targetKey: roleName,
    beforeValue: beforeRate,
    afterValue: rate,
  });
}
  

  function updateRate(index: number, field: keyof RateRow, value: string) {
    const parsed =
      field === "role" ? value : Number.isFinite(Number(value)) ? Number(value) : 0;

    updateConfig({
      ...config,
      rates: config.rates.map((r, i) =>
        i === index ? { ...r, [field]: parsed } : r
      ),
    });
  }

  function addRate() {
    updateConfig({
      ...config,
      rates: [
        ...config.rates,
        {
          role: "",
          day: 0,
          night: 0,
          sunday: 0,
          publicHoliday: 0,
          over8: 0,
          over10: 0,
        },
      ],
    });
  }

  async function removeRate(index: number) {
  const rate = config.rates[index];

  if (rate?.role) {
    const { error } = await authClient
      .from("rate_cards")
      .update({ is_active: false })
      .eq("role_name", rate.role);

    if (error) {
      console.error("Error deleting rate card:", error);
      alert("Error deleting rate card: " + error.message);
      return;
    }

    await writeConfigAuditLog({
      changeType: "rate_card_delete",
      targetKey: rate.role,
      beforeValue: rate,
      afterValue: { ...rate, is_active: false },
    });
  }

  updateConfig({
    ...config,
    rates: config.rates.filter((_, i) => i !== index),
  });
}

function sortHolidays(
  holidays: { date: string; label: string }[]
) {
  return [...holidays].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

async function saveHolidayToSupabase(holiday: { date: string; label: string }) {
  if (!holiday.date || !holiday.label.trim()) return;

  const { error } = await authClient
    .from("public_holidays")
    .upsert(
      {
        holiday_date: holiday.date,
        name: holiday.label.trim(),
        state_code: "VIC",
        is_active: true,
      },
      { onConflict: "holiday_date" }
    );

  if (error) {
    console.error("Error saving public holiday:", error);
    alert("Error saving public holiday: " + error.message);
  }
}

function updateHoliday(
  index: number,
  field: "date" | "label",
  value: string
) {
  updateConfig({
    ...config,
    publicHolidays: config.publicHolidays.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    ),
  });
}

async function sortPublicHolidays() {
  const sorted = sortHolidays(config.publicHolidays);

  updateConfig({
    ...config,
    publicHolidays: sorted,
  });

  for (const holiday of sorted) {
    await saveHolidayToSupabase(holiday);
  }
}

function addHoliday() {
  updateConfig({
    ...config,
    publicHolidays: [...config.publicHolidays, { date: "", label: "" }],
  });
}

async function writeConfigAuditLog({
  changeType,
  targetKey,
  beforeValue,
  afterValue,
}: {
  changeType: string;
  targetKey: string;
  beforeValue: unknown;
  afterValue: unknown;
}) {
  const { data: sessionData } = await authClient.auth.getSession();

  const user = sessionData.session?.user;

  const { error } = await authClient.from("config_audit_log").insert([
    {
      change_type: changeType,
      target_key: targetKey,
      changed_by: user?.id || null,
      changed_by_email: user?.email || null,
      before_value: beforeValue,
      after_value: afterValue,
    },
  ]);

  if (error) {
    console.error("Failed to write config audit log:", error);
  }
}

async function removeHoliday(index: number) {
  const holiday = config.publicHolidays[index];

  if (holiday?.date) {
    const { error } = await authClient
      .from("public_holidays")
      .update({ is_active: false })
      .eq("holiday_date", holiday.date);

    if (error) {
      console.error("Error deleting public holiday:", error);
      alert("Error deleting public holiday: " + error.message);
      return;
    }
  }

  updateConfig({
    ...config,
    publicHolidays: config.publicHolidays.filter((_, i) => i !== index),
  });
}

  const cardClass =
  "rounded-2xl border border-slate-700 bg-slate-900 p-6 md:p-7 space-y-5 shadow-lg";

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white placeholder-white/35 outline-none focus:border-amber-400/60";

  const numberInputClass =
    "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-amber-400/60";

  const sectionTitleClass = "text-2xl font-semibold tracking-tight text-white";
  const fieldLabelClass = "block text-sm font-medium text-white/75 mb-1";
  const mobileRateLabelClass = "block md:hidden text-xs mb-1 text-white/55 uppercase tracking-wide";

 

  return (
  <div className="min-h-screen bg-slate-950 text-white">
    <main className="admin-shell">
      <div>
  <h1 className="admin-page-title">
          Admin Console
        </h1>
        <p className="admin-page-subtitle">
          Manage estimator settings, labour rates, public holidays, and quote defaults.
        </p>
      </div>

      <section className="admin-card">
        <div className="px-1 md:px-2">
          <h2 className="admin-section-title">Core Settings</h2>
        </div>

        <div className="admin-grid-2">
          <label>
            <span className={fieldLabelClass}>Currency</span>
            <input
              className={inputClass}
              value={config.currency}
              onChange={(e) =>
                updateConfig({ ...config, currency: e.target.value })
              }
            />
          </label>

          <label>
            <span className={fieldLabelClass}>GST Rate</span>
            <input
              type="number"
              step="0.01"
              className={numberInputClass}
              value={config.gstRate}
              onChange={(e) =>
                updateConfig({ ...config, gstRate: Number(e.target.value) || 0 })
              }
            />
          </label>

          <label>
            <span className={fieldLabelClass}>Minimum Billable Hours</span>
            <input
              type="number"
              step="0.5"
              className={numberInputClass}
              value={config.minBillableHours}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  minBillableHours: Number(e.target.value) || 0,
                })
              }
            />
          </label>

          <label>
            <span className={fieldLabelClass}>Day Start</span>
            <input
              className={inputClass}
              value={config.dayStart}
              onChange={(e) =>
                updateConfig({ ...config, dayStart: e.target.value })
              }
            />
          </label>

          <label>
            <span className={fieldLabelClass}>Night Start</span>
            <input
              className={inputClass}
              value={config.nightStart}
              onChange={(e) =>
                updateConfig({ ...config, nightStart: e.target.value })
              }
            />
          </label>
        </div>
      </section>
      
      <section className="admin-card">
  <div className="flex items-center justify-between gap-4 px-1 md:px-2 admin-action-row">
    <h2 className={sectionTitleClass}>User Access Management</h2>
  </div>

  <div className="space-y-3 px-1 md:px-2">
  <p className="text-sm text-gray-300">Users loaded: {users.length}</p>
    {users.map((user) => (
      <div key={user.id} className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          className={inputClass}
          value={user.email || ""}
          disabled
        />

        <input
          className={inputClass}
          placeholder="Full name"
          value={user.full_name || ""}
          onChange={(e) =>
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id ? { ...u, full_name: e.target.value } : u
              )
            )
          }
          onBlur={() =>
            updateUserProfile(user.id, { full_name: user.full_name || "" })
          }
        />

        <select
          className={inputClass}
          value={user.role || "staff"}
          onChange={(e) =>
            updateUserProfile(user.id, { role: e.target.value })
          }
        >
          <option value="staff">staff</option>
          <option value="admin">admin</option>
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!user.is_active}
            onChange={(e) =>
              updateUserProfile(user.id, { is_active: e.target.checked })
            }
          />
          Active
        </label>
      </div>
    ))}
  </div>
</section>

      <section className="admin-card">
        <div className="flex items-start justify-between gap-4 px-1 md:px-2 admin-action-row">
          <div className="space-y-2 px-1">
            <h2 className={sectionTitleClass}>Rates</h2>
            <p className="text-sm text-white/55">
              Update the hourly charge rates used by the estimator for each labour category.
            </p>
            <p className="text-xs text-white/45">
              Day and Night are base rates. Sunday and Public Holiday override where applicable. Over 8 hrs and Over 10 hrs are overtime thresholds.
            </p>
          </div>

          <button
            onClick={addRate}
            className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 font-medium text-black transition hover:bg-amber-400"
          >
            Add Role
          </button>
        </div>

        <div className="admin-rates-head">
  <div>Role</div>
  <div>Day</div>
  <div>Night</div>
  <div>Sunday</div>
  <div>Public Holiday</div>
  <div>Over 8 hrs</div>
  <div>Over 10 hrs</div>
  <div>Action</div>
</div>

        <div className="space-y-4 px-1 md:px-2">
          {config.rates.map((rate, index) => (
            <div
              key={index}
              className="admin-rate-row"
            >
              <div>
                <label className={mobileRateLabelClass}>Role</label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-bold text-white placeholder-slate-400 outline-none focus:border-amber-400"
                  placeholder="Role"
                  value={rate.role}
                  onChange={(e) => updateRate(index, "role", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div>
                <label className={mobileRateLabelClass}>Day</label>
                <input
                  type="number"
                  step="0.01"
                  className={numberInputClass}
                  value={rate.day}
                  onChange={(e) => updateRate(index, "day", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div>
                <label className={mobileRateLabelClass}>Night</label>
                <input
                  type="number"
                  step="0.01"
                  className={numberInputClass}
                  value={rate.night}
                  onChange={(e) => updateRate(index, "night", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div>
                <label className={mobileRateLabelClass}>Sunday</label>
                <input
                  type="number"
                  step="0.01"
                  className={numberInputClass}
                  value={rate.sunday}
                  onChange={(e) => updateRate(index, "sunday", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div>
                <label className={mobileRateLabelClass}>Public Holiday</label>
                <input
                  type="number"
                  step="0.01"
                  className={numberInputClass}
                  value={rate.publicHoliday}
                  onChange={(e) => updateRate(index, "publicHoliday", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div>
                <label className={mobileRateLabelClass}>Over 8 hrs</label>
                <input
                  type="number"
                  step="0.01"
                  className={numberInputClass}
                  value={rate.over8}
                  onChange={(e) => updateRate(index, "over8", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div>
                <label className={mobileRateLabelClass}>Over 10 hrs</label>
                <input
                  type="number"
                  step="0.01"
                  className={numberInputClass}
                  value={rate.over10}
                  onChange={(e) => updateRate(index, "over10", e.target.value)}
                  onBlur={() => saveRateToSupabase(config.rates[index], index)}
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => removeRate(index)}
                  className="admin-danger-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <div className="flex items-center justify-between gap-4 px-1 md:px-2 admin-action-row">
          <h2 className={sectionTitleClass}>Public Holidays</h2>
          <button
            onClick={addHoliday}
            className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-black transition hover:bg-amber-400"
          >
            Add Holiday
          </button>
        </div>

        <div className="space-y-3 px-1 md:px-2">
  {config.publicHolidays.map((h, index) => (
    <div key={index} className="admin-holiday-row">
      <input
  type="date"
  className={inputClass}
  value={h.date || ""}
  onChange={(e) => updateHoliday(index, "date", e.target.value)}
  onBlur={sortPublicHolidays}
/>

      <input
  className={inputClass}
  placeholder="Holiday description"
  value={h.label}
  onChange={(e) => updateHoliday(index, "label", e.target.value)}
  onBlur={() => saveHolidayToSupabase(config.publicHolidays[index])}
/>

      <button
        onClick={() => removeHoliday(index)}
        className="admin-danger-btn"
      >
        Delete
      </button>
    </div>
  ))}
</div>
      </section>

      <section className="admin-card">
        <div className="px-1 md:px-2">
  <h2 className={sectionTitleClass}>Terms and Conditions</h2>
  <p className="admin-section-note admin-autosave-note">
    Changes are saved automatically.
  </p>
</div>

        <div className="px-1 md:px-2">
          <textarea
            className="w-full min-h-[240px] rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-white/35 outline-none focus:border-amber-400/60"
            value={config.quoteText.termsAndConditions}
            onChange={(e) =>
              updateConfig({
                ...config,
                quoteText: {
                  ...config.quoteText,
                  termsAndConditions: e.target.value,
                },
              })
            }
          />
        </div>
      </section>
      
      
      <section className="admin-card">
  <div className="space-y-4">
    <div>
      <h2 className={sectionTitleClass}>Quote Administration</h2>
      <p className="text-sm text-white/60">
        Destructive quote management actions.
      </p>
    </div>

    <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 space-y-3">
      <p className="text-sm text-red-200">
        Permanently remove all saved quotes. This action cannot be undone.
      </p>

      {/* Step 1 button */}
      {!showClearQuotesConfirm && !showFinalClearQuotesConfirm && (
        <button
          type="button"
          onClick={handleBeginClearAllQuotes}
          className="admin-danger-btn"
        >
          Remove All Saved Quotes
        </button>
      )}

      {/* Step 2 confirm */}
      {showClearQuotesConfirm && !showFinalClearQuotesConfirm && (
        <div className="space-y-3">
          <p className="text-sm text-white/85">
  This will permanently delete{" "}
  <span className="font-semibold text-red-300">
    {quoteCount} saved quote{quoteCount === 1 ? "" : "s"}
  </span>.
</p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleContinueClearAllQuotes}
              className="admin-danger-btn"
            >
              Yes, continue
            </button>

            <button
              type="button"
              onClick={handleCancelClearAllQuotes}
              className="admin-muted-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 3 final confirmation */}
      {showFinalClearQuotesConfirm && (
        <div className="space-y-3">
          <p className="text-sm text-white/85">
  Final confirmation: you are about to delete{" "}
  <span className="font-semibold text-red-300">
    {quoteCount} saved quote{quoteCount === 1 ? "" : "s"}
  </span>.  
  Type <span className="font-semibold text-red-300">DELETE</span> to proceed.
</p>

          <input
            type="text"
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className={inputClass}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmClearAllQuotes}
              className="admin-danger-btn"
            >
              Remove All Quotes
            </button>

            <button
              type="button"
              onClick={handleCancelClearAllQuotes}
              className="admin-muted-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
</section>

      <div className="px-1 md:px-2">
        <button
          onClick={restoreDefaults}
          className="admin-muted-btn"
        >
          Restore Defaults
        </button>
      </div>
    </main>
    </div>
  );
}