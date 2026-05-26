# GigPower Quote Estimator — TODO / Parked Items

Outstanding work, roughly ordered by importance. Consider promoting to GitHub
Issues if the list grows.

---

## Bugs

### Duplicate quote-number error on save
- **Symptom:** `duplicate key value violates unique constraint
  "quotes_quote_number_live_unique"` when saving (seen on GP-000100
  "Escape The Fate", version 3+, status "Exported to Operations").
- **What we know:** `quotes_quote_number_live_unique` is a *partial unique
  index* (not in `pg_constraint`), enforcing one live quote per number.
- **Diagnostic plan (not yet run — read-only, change nothing first):**
  1. Get the index definition:
     `SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename='quotes' AND indexname='quotes_quote_number_live_unique';`
  2. Count live rows for the number:
     `SELECT id, quote_number, current_version, status, is_deleted
      FROM quotes WHERE quote_number='GP-000100';`
- **Decide:** stale duplicate data vs. a save-path bug, before changing anything.
  `saveDraft` update path uses `.update().eq("id", overwriteId)`; insert only in
  the new-save else-branch.

---

## Cleanups / tech debt

### Two stale validation layers out of step with the data model
- `src/lib/estimator/validation.ts` — `isValidLabourLine` checks `role` (not
  `callName`); `isValidNonLabourLine` checks `description` only (not `title`).
- `src/lib/schema.ts` (Zod) — `labourLineSchema` validates `role`;
  `nonLabourLineSchema` has `title` optional, `description` required.
- Both predate the title/callName model. **Action:** check whether either is
  still wired in anywhere; reconcile with current model or remove. Risk if left:
  confusing/incorrect validation if they get re-used.

### Multiple Supabase client instances
- Browser warning: "Multiple GoTrueClient instances detected." Caused by two
  clients (`supabaseData` in `src/lib/supabase.ts` + the `createClient()`
  browser client). Harmless but untidy. **Action:** consolidate to one shared
  instance eventually.

### Admin "minimum hours" wording
- `LabourTable.tsx` "Fix inputs" message reads "labour durations must be at
  least {minBillableHours} hours" → shows "at least 0 hours" for admins (where
  `minBillableHours` is forced to 0). Cosmetic reword.

---

## Nice-to-have

### Apply `formatAuDate` to other PDF dates
- The PDF Quote Date and Valid Until fields still render raw `YYYY-MM-DD`.
  Apply `formatAuDate()` (already in `route.ts`) for `DD/MM/YYYY` consistency
  with the Event Date.

### CrewFinder export hardcoded fields
- `venue_address`, `event_notes`, `access_notes` are hardcoded `""` in
  `crewfinderExport.ts`. Wire to real inputs if/when those fields exist.

### Consider GitHub Issues
- If this list grows, migrate items to GitHub Issues for better tracking
  (labels, status, linking to commits/PRs).
