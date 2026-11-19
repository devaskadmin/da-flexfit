# WorkoutAtlas Documentation Inventory

**Purpose:** Record repository Markdown sources, accuracy, overlap, and disposition.
**Status:** repository inventory 2026-11-18.

| Path | Purpose | Accuracy | Overlap | Action |
|---|---|---|---|---|
| `README.md` | Repository bootstrap and canonical navigation | Updated for this system | Replace default project text | UPDATE |
| `AGENTS.md` | Agent operating contract | Source-backed | New canonical | KEEP |
| `CHANGELOG.md` | Chronological product changes | Historical; live 0.85.309 entries preserved | Overlaps batch evidence only by detail | KEEP |
| `WORKOUTATLAS_BATCH_RESULTS.md` | Historical verification execution log | Preserved; latest live evidence source-backed | Overlaps changelog summaries | KEEP as compatibility/historical record |
| `DATABASE_SCHEMA.md` | Legacy database overview | OUTDATED version label 0.7.1-beta | Overlaps new database docs | UPDATE and link to canonical `docs/database/SCHEMA.md` |
| `backend/RENDER_SETUP.md` | Render/backend environment setup | Likely stale version and partial; source references remain useful | Overlaps environment matrix | INVESTIGATE then UPDATE |
| `backend/migrations/CURRENT_SCHEMA_VERSION.md` | Migration/system registry | Schema date stale vs migration files | Overlaps schema docs | UPDATE |
| `backend/docs/community-sharing-architecture.md` | Community/Featured plan design | Repository source-supported | Overlaps plan/role docs | KEEP |
| `backend/docs/workout-plan-template-v1.md` | Canonical plan template format | Repository service-supported | Limited overlap | KEEP |
| `backend/docs/exercise_scope_stage1_design.md` | ExerciseScope design | Source-supported, incomplete in places | Overlaps implementation checklist/migration package | CONSOLIDATE |
| `backend/docs/exercise_scope_implementation_checklist_085100.md` | ExerciseScope implementation checklist | Source-supported | Overlaps stage design/migration | CONSOLIDATE |
| `backend/migrations/security/20261017_exercise_scope_stage1_migration_package.md` | ExerciseScope migration package | Migration artifact evidence | Overlaps stage docs | CONSOLIDATE with an index |
| `frontend/README.md` | Frontend setup | Source-supported | Minimal overlap | KEEP |
| `backend/free-exercise-db-main/README.md` | Third-party dependency | Third-party | Exclude from project docs | EXCLUDE |

## Major conflicts

- `DATABASE_SCHEMA.md` displays `0.7.1-beta`, while package versions are `0.85.308`.
- `backend/RENDER_SETUP.md` identifies a last-updated 0.81.7 era while the repository is at 0.85.308.
- `CURRENT_SCHEMA_VERSION.md` was last dated 2026-08-04, while repository migrations include 2026-11-17 work.
- ExerciseScope design/checklist/migration documents are related but not centralized; canonical implementation status is source-backed by code/tests.

## Broken or unverified references

- Legacy SQL path references under `DATABASE_SCHEMA.md` require replacement by canonical `docs/database/SCHEMA.md`.
- Live database metadata was not introspected.
- Live production infrastructure and deployment status are not verified from repository-only evidence.

## Preservation

No historical Markdown file was deleted by DEVOPS-DOCS-001. Existing 0.85 history and QA evidence remain in root compatibility files and the new 0.85 QA release file.
