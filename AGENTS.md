# Codex Project Management Playbook

This repository is set up so Codex can help manage work from intake to delivery.

## Core workflow
1. Capture incoming requests in `PROJECT_TASKS.md`.
2. Propose a short implementation plan before coding.
3. Make the smallest safe code change that satisfies the request.
4. Run at least one relevant validation command (`npm run lint` or `npm run build`).
5. Update task status in `PROJECT_TASKS.md`.
6. Commit with a concise, imperative message.

## Task states
Use these statuses in `PROJECT_TASKS.md`:
- `todo`
- `in_progress`
- `blocked`
- `done`

## Prioritization rule
When multiple tasks exist, prioritize by:
1. Production bug fixes
2. Data/security correctness
3. UX issues affecting quotes/printing
4. New features
5. Refactors/docs

## Definition of done
A task is `done` only when:
- Code and docs are updated as needed.
- Relevant checks have been run and reported.
- Any follow-up items are explicitly listed.
