---
description: "Run read-only WorkoutAtlas QA and report unresolved requirements without mutating records."
agent: "agent"
argument-hint: "Feature or release checkpoint to verify"
---

Default to read-only. Do not create plans/accounts/exercises/workouts or delete history unless a disposable scope is explicitly authorized.

- Use `docs/engineering/CURRENT-STATE.md` and the existing QA matrix.
- Reuse prior proven evidence.
- Verify only unresolved requirements.
- Report PASS/FAIL/BLOCKED/PENDING and release-blocker impact.
- Protect PlanID 5, personal history, paused sessions, and non-disposable plans.
