# WorkoutAtlas Current State

**Purpose:** First detailed status document for AI agents.

## Application status

- Product: WorkoutAtlas
- Package versions: frontend `0.85.308`; backend `0.85.308`
- Branch: `BETA`
- Latest verified HEAD: `ecb2b654ec40d1211bcec53f79fb61ac33bc1ada`
- Branch relationship: ahead of `origin/BETA` by 2 commits; exact upstream state is not a release acceptance claim.
- QA checkpoint: `0.85.309`
- Release phase: live acceptance pending
- Local development: frontend and backend have been observed reachable on ports 5173 and 5000
- Production status: UNVERIFIED in this repository documentation
- Last evidence update: 2026-11-18

## Current work

- Active workstream: `0.85.309` live acceptance closeout.
- Last completed task: `DEVOPS-DOCS-001`, enterprise documentation and AI governance consolidation.
- Current blockers: publish/unpublish live persistence replay, Featured registration data, live role write mutations, ExerciseScope mutations, and live two/third-session verification remain blocked or acceptance-pending.
- User acceptance outstanding: 0.85.309 release acceptance.
- Next authorized action: complete live acceptance only after explicit disposable-test scope; then approve package/release decision.

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
