# WorkoutAtlas Current State

**Purpose:** First detailed status document for AI agents.

## Application status

- Product: WorkoutAtlas
- Package versions: frontend `0.85.308`; backend `0.85.308`
- Branch: `BETA`
- Latest verified HEAD: `b7a4481702201de0b6577591828d965cb418b4c4`
- Branch relationship: ahead of `origin/BETA` by 3 commits; exact upstream state is not a release acceptance claim.
- QA checkpoint: `0.85.309`
- Release phase: live acceptance pending
- Local development: frontend and backend have been observed reachable on ports 5173 and 5000
- Production status: UNVERIFIED in this repository documentation
- Last evidence update: 2026-11-18

## Current work

- Active workstream: `0.85.313` critical backend recovery (route restoration only), with prior `0.85.309` acceptance and UI follow-up still pending.
- Last completed task: `DEVOPS-DOCS-002`, enterprise AI onboarding validation and backlog synchronization.
- Previously completed task: `DEVOPS-DOCS-001`, enterprise documentation and AI governance consolidation.
- Current blockers: publish/unpublish live persistence replay, Featured registration data, live role write mutations, ExerciseScope mutations, live two/third-session verification, and `WA-UI-TABLET-001` tablet Find Plans responsiveness remain blocked or acceptance-pending.
- User acceptance outstanding: 0.85.309 release acceptance.
- Next authorized action: complete the live 0.85.309 acceptance gates after explicit disposable scope; the next targeted UI implementation task is `WA-UI-TABLET-001 — Tablet Find Plans responsiveness` after implementation approval.

## 0.85.313 recovery checkpoint (2026-11-21)

- Recovery-only action completed for `backend/api/users.js` after interrupted/OOM edit state removed canonical API handlers.
- Route inventory was restored to Git HEAD parity (`37/37` route signatures, `0` missing, `0` extra).
- Critical compatibility endpoints confirmed restored: `GET/PUT /workout-planner` and `PUT /workout-schedules/:id/groups`.
- Validation completed:
	- `node --check backend/api/users.js` (pass)
	- `node --test tests/workout-plan-conversion-engine.test.js tests/workout-plan-cover-service.test.js tests/workout-plan-cover-storage.test.js` (`30/30` pass)
	- `node --test tests/workout-plan-template.test.js` (`8/8` pass)
- Data protection preserved: no DB migration, no runtime DB write as part of recovery verification, no mutation of protected PlanID `5`.
- Phase 1 feature development remains paused pending explicit approval to resume after recovery review.

## Protected data and constraints

- Never modify PlanID `5` — Stephen K – Lean Muscle.
- Never modify existing personal workout history or existing paused sessions.
- Do not change non-disposable Global plans or production accounts.
- Database migrations, database writes, destructive cleanup, server restart, push, deployment, and infrastructure changes require explicit authorization.
- This repository currently has no authorized database or destructive-test scope for this documentation task.

## Release-state definitions

- **CODE IMPLEMENTED:** source behavior exists and is traceable to code.
- **AUTOMATED TESTS PASSED:** project-owned or targeted automated evidence passed; not user acceptance.
- **LIVE TESTED:** an authenticated browser/API environment performed the workflow.
- **USER ACCEPTED:** explicit user approval for a workflow or release state.
- **RELEASED:** deployment/release was separately authorized and verified.

Current evidence: implementation and automated coverage exist for many areas. Live evidence exists for planning discovery/copy, timer/start/completion, history correction/deletion, preview, and mobile layout. Several acceptance gates remain unresolved. 0.85.309 is **not user accepted**.

## Canonical references

- Backlog: [../backlog/BACKLOG.md](../backlog/BACKLOG.md)
- Session handoff: [SESSION-HANDOFF.md](SESSION-HANDOFF.md)
- QA checkpoint: [../qa/releases/0.85/0.85.309.md](../qa/releases/0.85/0.85.309.md)
- Architecture: [../architecture/SYSTEM-ARCHITECTURE.md](../architecture/SYSTEM-ARCHITECTURE.md)
- Database: [../database/SCHEMA.md](../database/SCHEMA.md)
- Product history: [../../CHANGELOG.md](../../CHANGELOG.md)

## UI corrective closeout

- `WA-UI-TABLET-001` implementation is code complete and automated/browser verification passed.
- Find Plans uses cards at 769–1024px and preserves the desktop table above 1024px.
- Automated and live read-only viewport evidence does not replace explicit user acceptance.
