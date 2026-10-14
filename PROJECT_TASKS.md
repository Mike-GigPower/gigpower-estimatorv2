# Project Tasks

## Intake
- [ ] (todo) Define your first managed task here.

## Active
- [ ] (in_progress) Customer rate cards P1, Stage 2 (code): card sets in loaders, MOPT / Australian Open quote header, card-aware call-name → role, export schema 1.2, admin card picker, null OT tiers, no stale-card fallback. Code + unit tests done. Migration A applied 14 Oct 2026 and verified (12 Standard rows; the public key sees 10 rows and 0 card sets). Next: commit to branch `rate-cards-stage2`, then run acceptance tests 1, 2, 10, 13–15, 17–19 on the Vercel preview, then merge to main. Migration B (MOPT seed) only after Stage 2 is live and Rich answers Q-B and Q-C.

- [ ] (in_progress) Customer rate cards P1, Stage 2b (Amendment 2): MOPT quotes offer only the card's role names. Dropdown built from the card's `call_names` (`cardCallNames`), Training / Field of Play call names removed, admin saves customer rows with `call_names = [role_name]`, tests updated (7, 11, 12, 16) and added (3 / 4 AO roles offered). Next: commit on a branch, preview, merge, then Migration B with `call_names = array[role_name]`. Follow-ups: THE GOAT + SmartStaff need the seven MOPT role names as call names before MOPT quotes are exported; ask Rich whether FOH Spot on M&OP becomes Event Operations or isn't quoted.

## Blocked
- [ ] (blocked) _None_

## Done
- [x] (done) Initialized Codex project management playbook and task board.
