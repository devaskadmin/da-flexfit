# WorkoutAtlas Agent Operating Contract

## Identity
WorkoutAtlas is a Vue 3/Vite frontend and Node.js/Express/MySQL application for workout planning, exercise management, session tracking, and workout history.

## Start Here
1. Read `docs/engineering/CURRENT-STATE.md`.
2. Read `docs/engineering/SESSION-HANDOFF.md`.
3. Read `docs/backlog/BACKLOG.md`.
4. Read the relevant architecture, database, API, and instruction documents.

## Source Precedence
- Source code and verified migrations override older prose claims.
- `CHANGELOG.md` is the product change history.
- `WORKOUTATLAS_BATCH_RESULTS.md` is preserved historical QA evidence; canonical QA summaries link to release evidence under `docs/qa/`.
- Package JSON versions are authoritative for the current package version.
- Never infer a live database, deployment, or user acceptance claim without evidence.

## Hard Restrictions
- No application source changes without explicit task authorization.
- No pushes, deployments, migrations, database writes, server restarts, or infrastructure changes without explicit authorization.
- Preserve PlanID 5 (`Stephen K – Lean Muscle`), existing personal history, paused sessions, and non-disposable Global plans.
- A test instruction does not authorize destructive writes.
- Do not advance package versions for documentation-only work.
- Do not mark automated passes or live implementation checks as user acceptance.

## Change Control
Read `docs/governance/CHANGE-CONTROL.md` and `docs/ai-development/AI-SAFETY-GUARDRAILS.md` before actions. Update canonical docs in place; do not create duplicate reports.

## Repository Publication Security

Before every local commit:
- Review staged paths and staged diff.
- Verify `.local-only/`, `.artifacts/`, environment overrides, certificates, and private-key patterns are excluded.
- Confirm no credentials or private infrastructure details are included.

Before every GitHub push:
- Explicit user authorization is mandatory.
- Pass the local `scripts/security/security_check.ps1` gate.
- Review all unpublished commits against origin/BETA.
- Confirm no unresolved critical finding remains.
- Never infer push safety from a passing build or clean working tree.

Secrets must not be copied into prompts, handoffs, reports, or documentation. Gitignore is not privacy against external AI or chat systems.
