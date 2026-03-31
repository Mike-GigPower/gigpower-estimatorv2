"use client";

import { useAppConfig } from "@/src/lib/useAppConfig";
import type { RateRow } from "@/src/lib/types";
import { useState } from "react";

export default function AdminPage() {
  const { config, updateConfig, restoreDefaults, ready } = useAppConfig();
  const [authorised, setAuthorised] = useState(false);
  const [password, setPassword] = useState("");

  if (!ready) return <main className="max-w-5xl mx-auto px-6 py-8">Loading...</main>;

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

  function removeRate(index: number) {
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

function sortPublicHolidays() {
  updateConfig({
    ...config,
    publicHolidays: sortHolidays(config.publicHolidays),
  });
}

function addHoliday() {
  updateConfig({
    ...config,
    publicHolidays: [...config.publicHolidays, { date: "", label: "" }],
  });
}

function removeHoliday(index: number) {
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

  if (!authorised) {
    return (
      <main className="admin-login-shell">
        <h1 className="admin-page-title">
          Admin Console
        </h1>
        <p className="admin-page-subtitle">
          Manage rates, rules, and quote defaults.
        </p>

        <div className="admin-card">
  <input
    type="password"
    placeholder="Admin password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className={inputClass}
  />

  <div className="admin-login-action">
    <button
      onClick={() => {
        if (password === "gigpoweradmin") setAuthorised(true);
        else alert("Incorrect password");
      }}
      className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-black transition hover:bg-amber-400"
    >
      Login
    </button>
  </div>
</div>
      </main>
    );
  }

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