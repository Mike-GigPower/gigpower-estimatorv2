# Project Tasks

## Intake
- [ ] (todo) Define your first managed task here.

## Active
- [ ] (in_progress) Customer rate cards P1, Stage 2 (code): card sets in loaders, MOPT / Australian Open quote header, card-aware call-name → role, export schema 1.2, admin card picker, null OT tiers, no stale-card fallback. Code + unit tests done. Migration A applied 14 Oct 2026 and verified (12 Standard rows; the public key sees 10 rows and 0 card sets). Next: commit to branch `rate-cards-stage2`, then run acceptance tests 1, 2, 10, 13–15, 17–19 on the Vercel preview, then merge to main. Migration B (MOPT seed) only after Stage 2 is live and Rich answers Q-B and Q-C.

- [ ] (in_progress) Customer rate cards P1, Stage 2b (Amendment 2): MOPT quotes offer only the card's role names. Dropdown built from the card's `call_names` (`cardCallNames`), Training / Field of Play call names removed, admin saves customer rows with `call_names = [role_name]`, tests updated (7, 11, 12, 16) and added (3 / 4 AO roles offered). Next: commit on a branch, preview, merge, then Migration B with `call_names = array[role_name]`. Follow-ups: THE GOAT + SmartStaff need the seven MOPT role names as call names before MOPT quotes are exported; ask Rich whether FOH Spot on M&OP becomes Event Operations or isn't quoted.
- [ ] (in_progress) Pricing rules Stage 0, Stage D (release check, BRIEF §7): `pricingCases.ts` validates the §7.1 case format and runs a case against `calculateLabourLine` (to the cent; segments and billable hours when given; scope `goat` skipped). `scripts/pricing-tests.ts` fetches cases from `RATE_CARDS_URL` with `X-GOAT-Secret`, prints a table, exits non-zero on any failure; `prebuild` runs it. No secret → fails unless `PRICING_TESTS_OFFLINE=1` (honoured only while no secret is set). Zero cases pass with a loud warning (the state between Stage E and F). The brief's 22 §9.1 cases are a test fixture and all pass. Before merging: Vercel needs `PRICING_TESTS_OFFLINE=1` until Stage E is deployed, then `RATE_CARDS_URL` + `RATE_CARDS_SECRET` (all environments) and remove the offline flag.

## Blocked
- [ ] (blocked) _None_

## Done
- [x] (done) Pricing rules Stage 0, Stage C (calculator, BRIEF §5.1–5.5): `double_penalty_windows` loaded by both loaders (a failed read blocks pricing; `defaultConfig` has none); `calc.ts` cuts at every window edge and prices `max(existing, multiplier × PH rate)` on every tier; tooltip shows "Christmas ×2"; per-role `min_billable_hours` (null = global) in calc, quote duration gating and the admin rate screen (blank saves null). Unit tests X01–X09, C11–C13 pass; old vs new calc identical over 728,640 lines with no windows / no per-role minimums. Live on main (40050cb). Acceptance 7, 8, 16, 17 after Migration B. Not done here: §5.6 terms text (Joe), Stage D. Follow-ups: confirm anon can read `rate_cards.min_billable_hours` and `double_penalty_windows` (public request pricing fails closed otherwise); public request form still gates by the global minimum.
- [x] (done) Initialized Codex project management playbook and task board.
