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
| WA-CONTENT-001 | At-Home Full Body — No Equipment | CONTENT | 0.85 | P2 | PROPOSED | Manual content checklist | User approval |
| WA-CONTENT-002 | At-Home Full Body — Light Dumbbells | CONTENT | 0.85 | P2 | PROPOSED | Manual content checklist | User approval |
| WA-CONTENT-003 | Assisted Pull-Up Machine SYSTEM exercise and image | CONTENT | 0.85 | P2 | PROPOSED | Manual content checklist | User approval |
| WA-CONTENT-004 | Remaining Global plans and publication | CONTENT | 0.85 | P2 | PROPOSED | Manual content checklist | User approval |
| WA-DOCS-001 | Enterprise documentation and AI governance | DOCUMENTATION | 0.85.309 | P0 | CLOSED | DEVOPS-DOCS-001; documentation inventory, canonical docs, agent instructions, prompts, link validation completed | No remaining documentation implementation task |

Older implementation reports are evidence sources, not user acceptance. Do not duplicate a corrective task because it appears in multiple release entries.
