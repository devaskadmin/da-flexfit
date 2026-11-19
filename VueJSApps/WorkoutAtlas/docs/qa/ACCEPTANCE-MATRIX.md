# WorkoutAtlas Acceptance Matrix

| Workflow | Automated | Live tested | User accepted | State |
|---|---|---|---|---|
| Plan Builder create/save | Existing coverage | Disposably live-tested | No | LIVE TESTED |
| Plan publish/unpublish | Existing coverage | Not reliably live-completed | No | PENDING VERIFICATION |
| Global discovery/copy | Existing coverage | Live-tested | No | LIVE TESTED |
| Featured registration | Existing coverage | Blocked: no live Featured plan | No | BLOCKED |
| ExerciseScope mutation | Existing coverage | Not safely performed | No | PENDING VERIFICATION |
| Workout sessions | Existing coverage | Partial live-tested | No | PENDING USER ACCEPTANCE |
| History correction/deletion | Existing coverage | Live-tested disposable record | No | LIVE TESTED |
| HTTP 400 regression | Passed | Live-tested | No | LIVE TESTED |
| 390/800 mobile | Existing coverage | Live-tested | No | LIVE TESTED |
| WA-UI-TABLET-001 page-level overflow | Passed at 320/390/768/800/820/1024/1366px | Read-only browser-tested; no mutation | No | USER ACCEPTANCE PENDING |
| WA-UI-TABLET-001 internal table overflow and action access | Passed at 768/800/820/1024px; cards replace table | Read-only browser-tested; all card actions visible | No | USER ACCEPTANCE PENDING |
