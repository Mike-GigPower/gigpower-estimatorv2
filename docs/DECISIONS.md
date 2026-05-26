# GigPower Quote Estimator — Decisions & Rationale

A running log of *why* the code is the way it is. Add to it when a non-obvious
decision is made. Newest entries can go at the top of each section.

---

## Data model

### Role is derived from Call Name
A labour line has both `callName` (what the user picks, e.g. "Load In") and
`role` (the rate category, e.g. "Standard Crew"). `role` is derived from
`callName` via `roleForCallName()` in `src/lib/types.ts`, which falls back to
`"Standard Crew"` when the call name is unknown/empty. User-facing surfaces
(screen, PDF) should show **Call Name**; pricing uses the derived role.
- Legacy lines may have a `role` but blank `callName`. Display code should fall
  back: `line.callName || line.role || "-"`.

### Non-labour lines have both Title and Description
`NonLabourLine` carries `title` (item name, e.g. "Harness Hire") and
`description` (detail). Both are intended to be filled. The PDF shows title as
the bold item name with description in smaller grey text beneath.

### Quote statuses
`status` is one of: `Draft`, `Sent`, `Approved`, `Exported to Operations`.
The DB `quotes_status_check` constraint enforces exactly these four. (Originally
only the first three existed; "Exported to Operations" was added — see DB notes.)

---

## Validation

### `validateBeforeSave()` in page.tsx is the live save validation
Called at the top of `saveDraft()`; aborts the save with an alert listing
errors if invalid. Rules:
- **Header (mandatory):** Company Name, Contact Name, Contact Email (with email
  format check), Event/Estimate Name, Event Date, Venue.
- **Every labour line:** Call Name, qty > 0, valid shiftDate, valid startTime
  (HH:MM), duration > 0. (Reuses pricing-engine errors but excludes the "below
  minimum hours" advisory, which is informational, not blocking.)
- **Every *filled* non-labour line:** requires BOTH title AND description,
  qty > 0, amount >= 0. Untouched placeholder rows are skipped.
- **Non-labour-only estimates are allowed** — an estimate needs at least one
  labour line OR one filled non-labour line, not necessarily labour.

### Export filter is intentionally looser than save validation
The CrewFinder export (`crewfinderExport.ts`) includes a non-labour line if it
has a title OR description OR non-default qty/amount — deliberately more
permissive than save validation. This difference is intentional; don't
"fix" it to match without reason.

### There are TWO older, out-of-step validation layers (see TODO)
`src/lib/estimator/validation.ts` and `src/lib/schema.ts` (Zod) both predate the
title/callName model — they still validate `role` and require `description`
without `title`. Whether they're still wired in anywhere needs checking; they're
candidates for reconciliation or removal. Flagged in TODO.md.

---

## Pricing engine (`calc.ts`)

### Blank start time must NOT price as midnight
`parseTimeHHMM` has a numeric fallback, but `Number("")` and `Number("  ")`
evaluate to `0` (midnight), which would silently price a line with no start
time. Guarded with `if (!/\d/.test(raw)) return null;` before numeric coercion.

### `isQuoteEmpty` ignores auto-filled fields
A blank new quote auto-seeds `shiftDate` (today/event date), `startTime`
("08:00"), and `durationHours` (min billable). Testing those as "user data"
wrongly flagged blank quotes as non-empty and triggered a false "Unsaved
Changes" prompt. `hasLabourData` therefore only counts `callName`, `notes`, and
a non-default `qty`. Likewise it tests `callName` not `role` (role auto-derives,
so testing it flags blank quotes as non-empty).

### Cost-breakdown segments
`calculateLabourLine` emits `LabourCostSegment[]` (per tier/period/date, with
PER-CREW costExGst = hours × rate) so the UI hover tooltip can show the
breakdown. Carried through `calculateQuoteTotals`.

---

## PDF (`src/app/api/quote-pdf/route.ts`)

- PDFKit draws text at fixed x/y coordinates — adding a column means re-spacing,
  and variable-height rows must compute height via `doc.heightOfString` and
  advance `doc.y` accordingly (see `nonLabourLine`).
- Labour table shows **Call Name** (header + value), with `role` fallback.
- Non-labour: title bold, description 7pt grey (#666) beneath, auto row height.
- **Dates are formatted by string-parsing, NOT `new Date()`.** `formatAuDate()`
  converts `YYYY-MM-DD` → `DD/MM/YYYY` via regex. Using `new Date("YYYY-MM-DD")`
  parses as UTC midnight and can render a day early in Australian timezones — a
  real off-by-one bug. Always string-parse dates for display.

---

## CrewFinder export (`crewfinderExport.ts`)

- `schema_version` is `"1.1"` (bumped from "1.0" when `event_date` was added to
  the event block). **The downstream GOAT/SmartStaff importer must accept "1.1"
  before this is relied on** — coordinate version bumps with that team.
- `non_labour_lines` exports `line_id`, `title`, `description`, `quantity`,
  `unit_cost_ex_gst` per the GOAT import contract.
- `venue_address`, `event_notes`, `access_notes` are currently hardcoded `""`.
- Open product question: `title` is free-text now; may later be constrained to a
  preset enum for more reliable GOAT mapping.

---

## Database & schema tracking

### Path B: schema snapshots, not full migrations
DB schema is tracked via `db/schema-snapshot.md` — a committed dump of columns +
constraints (from a read-only SQL query). **Discipline: re-run the query and
re-commit after any schema change.** Chosen over full Supabase CLI migrations
because it's low-risk and fits a solo project; can graduate to migrations later.
- Captures columns + constraints only. Does NOT capture indexes, functions,
  triggers, or RLS policies.

### Quote-number uniqueness is a partial unique INDEX, not a constraint
`quotes_quote_number_live_unique` does not appear in `pg_constraint` (confirmed
via the schema snapshot), so it's a partial unique index — almost certainly
"one live quote per number." Relevant to the parked duplicate-key bug in TODO.

---

## Git / workflow history

- Repo was consolidated down to a single `main` branch (several overlapping
  codex/* and phase-1 branches were merged or obsolete and were deleted) to
  remove the risk of an old refactor branch clobbering current work.
- A stray `outputs/` folder (a full duplicate of `src/`) once broke the Vercel
  build; it was removed and added to `.gitignore`.
