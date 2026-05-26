# GigPower Quote Estimator — Project Brief

A short orientation document. Read this first to get up to speed quickly.
For the *why* behind specific design choices, see `DECISIONS.md`.
For outstanding work, see `TODO.md`.

## What it is

A web app for building and managing labour/equipment quotes ("estimates") for
GigPower (entertainment labour). Estimates are built on screen, saved with
versioning, exported to PDF for customers, and exported as JSON to a downstream
operations system ("CrewFinder" / SmartStaff).

## Stack

- **Next.js** (app router) + React + TypeScript
- **Supabase** (Postgres + auth) for data and login
- **PDFKit** for server-side PDF generation
- **Vercel** — auto-deploys on push to `main`
- Repo: `github.com/Mike-GigPower/gigpower-estimatorv2` (personal account, private)
- Local dev: `localhost:3000` (`npm run dev`)

## How it's worked on

- **Solo developer**, editing across two machines (home + work).
- Discipline: `git commit` + `push` when leaving a machine; `git pull` when arriving.
- Edits are made by hand and **verified with `git diff` before every commit**.
- Visual/PDF changes are **tested locally before pushing** (push = live, via Vercel).
- Treat git operations carefully and explain them clearly.

## Key files

- `src/app/page.tsx` — main estimator UI and state; holds `saveDraft`,
  validation, logout, and the `<AppHeader>` usage. The biggest file.
- `src/lib/estimator/calc.ts` — pricing engine: time parsing, labour line
  costing, quote totals, `isQuoteEmpty`, cost segments.
- `src/lib/types.ts` — the **real** shared type definitions (`QuoteInput`,
  `LabourLine`, `NonLabourLine`, results, config) and `roleForCallName()`.
- `src/lib/estimator/types.ts` — thin re-export shim pointing at `../types`.
- `src/lib/crewfinderExport.ts` — builds the CrewFinder JSON export payload
  (schema_version "1.1").
- `src/app/api/quote-pdf/route.ts` — PDFKit PDF generation.
- `src/app/components/` — `AppHeader`, `DraftToolbar`, `LabourTable`/`LabourRow`,
  `NonLabourTable`/`NonLabourRow`, `ClientDetailsCard`, `QuoteTotalsCard`,
  `TermsConditionsBox`.
- `src/app/admin/page.tsx` + `src/app/admin/requests/page.tsx` — admin screens,
  each with its own `checkAccess` guard (redirects non-admins to `/login`).
- `db/schema-snapshot.md` — committed snapshot of DB columns + constraints.

## Auth model

- Two Supabase clients exist: `supabaseData` (`src/lib/supabase.ts`,
  `persistSession: false`, for data) and a session-aware browser client from
  `createClient()` (`src/lib/supabase/client.ts`, used as `authClient`).
- **Session/login/logout must use `authClient`**, not `supabaseData`.
- User role lives in the `profiles` table; `isAdmin = currentUserRole === "admin"`.

## Working with this repo via Claude

- This repo is connected to Claude via the GitHub connector (project knowledge).
- **Hit "Sync now" at the start of a session and after pushing** — the connector
  reads a snapshot, so an unsynced view will be stale.
