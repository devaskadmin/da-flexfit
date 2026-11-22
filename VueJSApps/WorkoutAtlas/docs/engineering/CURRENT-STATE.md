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

- Active workstream: `0.85.309` live acceptance closeout plus approved UI implementation follow-up.
- Last completed task: `DEVOPS-DOCS-002`, enterprise AI onboarding validation and backlog synchronization.
- Previously completed task: `DEVOPS-DOCS-001`, enterprise documentation and AI governance consolidation.
- Current blockers: publish/unpublish live persistence replay, Featured registration data, live role write mutations, ExerciseScope mutations, live two/third-session verification, and `WA-UI-TABLET-001` tablet Find Plans responsiveness remain blocked or acceptance-pending.
- User acceptance outstanding: 0.85.309 release acceptance.
- Next authorized action: complete the live 0.85.309 acceptance gates after explicit disposable scope; the next targeted UI implementation task is `WA-UI-TABLET-001 — Tablet Find Plans responsiveness` after implementation approval.

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

## Restored-code verification audit - 2026-11-21

- Verification HEAD: `6dbf903b1e7ae1dd4e25fc34b07a1508fe6ed043`.
- Scope: read-only source verification; no application code, versions, migrations, server/database state, or protected data changed.
- `0.85.309` top-right Save button: FAIL — Save remains in the bottom primary-actions footer.
- `0.85.309a` Save-button alignment: FAIL — no top-right Save implementation or alignment correction found.
- `0.85.311` recording type, field ordering, layout, More/Less, tags: PASS — source trace and focused tests passed `5/5`.
- `0.85.312` bottom Add Day/Add Week controls after one day/week and two exercises: MISSING — no matching implementation or commit found.
- No live user acceptance is inferred; no 0.85.313 implementation was started.

## 0.85.309a top Save alignment - 2026-11-21

- Implementation complete in `frontend/src/views/Member/WorkoutBuilder.vue`.
- Back to Plans is far left and Save is far right in one full-width row.
- Back and Save use identical `32px` height and `32px` line height for vertical alignment.
- Save retains `#15803D` background and `#FFFFFF` text.
- Create and Edit modes share the responsive row alignment; no backend or save-handler changes were made.
- Focused frontend contract tests passed `21/21`; Vite production build passed with `701` modules transformed.
- User acceptance remains pending. Do not begin 0.85.313 or any subsequent implementation.

## 0.85.312 bottom Add Day/Add Week controls - 2026-11-21

- Implementation complete in `frontend/src/views/Member/WorkoutBuilder.vue`.
- Bottom controls appear after at least one Day/Week and at least two exercises, remain outside accordion bodies, and reuse existing bottom/top handler validation and append behavior.
- Create and Edit modes share the implementation; the controls use `#15803D` with `#FFFFFF` text.
- Existing top controls, Add Exercise controls, Save behavior, recording-field layout, backend APIs, and database structures were unchanged.
- Focused contract suite passed `12/12`; touched Vue/test diagnostics passed; Vite production build passed `701` modules and generated `dist`.
- Live browser visual and interaction acceptance remains pending. Do not begin 0.85.313.

## 0.85.311 FIX - Consolidated recording implementation - 2026-11-21

- Shared utility now uses Recording Type exclusively for field ordering and preserves independent Workout Type badges.
- Builder/session components retain exactly three horizontal fields per row, LBS labels, and 44px More/Less controls.
- Empty workout tags are hidden; valid Strength/Cardio/Other values remain Workout-Type-derived.
- 0.85.309/309a Save controls and 0.85.312 bottom schedule controls were preserved.
- Focused recording/builder tests passed `19/19`; touched diagnostics passed; Vite build passed `701` modules.
- Live visual acceptance across Create/Edit/View/preview/log/active/resume/history/mobile remains NOT VERIFIED.
- User acceptance remains pending; do not begin 0.85.313 or 0.85.315.

## 0.85.312 recovery checkpoint - 2026-11-21

- 0.85.309 top Save: implementation complete; automated contract/build verification passed; live acceptance pending.
- 0.85.309a Save alignment: implementation complete; Back-left/Save-right 32px controls verified by source/contracts; live acceptance pending.
- 0.85.311 FIX: recording utility/component corrections complete; focused tests passed `19/19`; live surface/viewport acceptance NOT VERIFIED.
- 0.85.312 bottom Add Day/Add Week: implementation complete; focused 12/12 coverage and build passed; live create/edit/week/collapsed/mobile acceptance pending.
- 0.85.313: TODO; no implementation authorized or started.
