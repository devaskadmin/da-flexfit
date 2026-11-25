# WorkoutAtlas Authoritative Backlog

## Status model

`PROPOSED` → `APPROVED` → `IN PROGRESS` → `CODE COMPLETE` → `TESTED` → `BLOCKED` or `USER ACCEPTANCE PENDING` → `ACCEPTED` → `CLOSED`; `DEFERRED` is allowed.

## 0.85 outstanding items

| ID | Feature / Defect | Category | Origin / Version | Priority | Status | Evidence | Acceptance |
|---|---|---|---|---|---|---|---|
| WA-QA-309-01 | Live publish/unpublish persistence replay | QA / REGRESSION | 0.85.309 | P1 | USER ACCEPTANCE PENDING | Live controls loaded; persistence replay was not reliable | Explicit release acceptance required |
| WA-QA-299-01 | Featured plan registration copy | QA / FEATURE | 0.85.299 | P1 | BLOCKED | Automated integration tests exist; live endpoint returned no plans | Requires disposable registration and Featured fixture |
| WA-QA-309-02 | Live trainer/admin/member Global write authorization | SECURITY / QA | 0.85.309 | P1 | USER ACCEPTANCE PENDING | Demo role UI visibility verified; server mutation scope not performed | Requires disposable records and role accounts |
| WA-QA-309-03 | ExerciseScope mutation permissions | SECURITY / QA | 0.85.309 | P1 | USER ACCEPTANCE PENDING | Existing search visibility passed; mutation not performed safely | Requires disposable exercise scope data |
| WA-QA-309-04 | Two-session and third-session enforcement | REGRESSION / QA | 0.85.309 | P1 | USER ACCEPTANCE PENDING | Automated session tests; live second/third replay incomplete | Requires two disposable sessions |
| WA-CONTENT-001 | At-Home Full Body — No Equipment | CONTENT | 0.85 | P2 | CLOSED | Owner-verified and published (0.85.320 closeout, owner statement) | Owner-stated |
| WA-CONTENT-002 | At-Home Full Body — Light Dumbbells | CONTENT | 0.85 | P2 | CLOSED | Owner-verified and published (0.85.320 closeout, owner statement) | Owner-stated |
| WA-CONTENT-003 | Assisted Pull-Up Machine SYSTEM exercise and image | CONTENT | 0.85 | P2 | PROPOSED | Manual content checklist | User approval |
| WA-CONTENT-004 | Remaining Global plans and publication | CONTENT | 0.85 | P2 | CLOSED | Initial library of 8 of 8 Global Workout Plans owner-verified and published (0.85.320 closeout, owner statement) | Owner-stated |
| WA-DOCS-001 | Enterprise documentation and AI governance | DOCUMENTATION | 0.85.309 | P0 | CLOSED | DEVOPS-DOCS-001; documentation inventory, canonical docs, agent instructions, prompts, link validation completed | No remaining documentation implementation task |
| WA-UI-TABLET-001 | Find Plans tablet table has internal horizontal scrolling and potentially clipped actions | UI REGRESSION | 0.85.309 acceptance review | P2 | USER ACCEPTANCE PENDING | Scoped 769–1024px card implementation verified at 320, 390, 768, 800, 820, 1024, and 1366px; no document/card/list overflow and all card actions visible at 320–1024px; desktop table restored at 1366px; search, no-match state, and read-only preview verified | User acceptance required; no live mutation or database write performed |

Older implementation reports are evidence sources, not user acceptance. Do not duplicate a corrective task because it appears in multiple release entries.

## 0.85 closeout note (0.85.320, 2026-11-25)

The owner declared the 0.85 milestone complete. The WA-QA-* items and WA-UI-TABLET-001 above were not individually verified and keep their recorded status; they are deferred follow-ups, not passed. WA-CONTENT-003 stays open. Also deferred from 0.85.317: confirm the catalog `RecordingType` of Marching in Place, Step Jacks (No Jumping) and Standing Knee Raises, and decide whether the backend should persist Recording Type. Next milestone: 0.86 (see `ROADMAP.md`).
