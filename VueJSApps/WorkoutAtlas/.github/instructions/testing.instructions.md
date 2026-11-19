---
name: WorkoutAtlas Testing
description: "Use for frontend/backend tests, QA matrices, browser acceptance, and evidence classification."
applyTo: ["**/*test*.js", "**/*test*.mjs", "backend/tests/**", "docs/qa/**"]
---

- Report PASS, FAIL, BLOCKED, PENDING VERIFICATION, and USER ACCEPTANCE PENDING distinctly.
- Prefer targeted tests before full suites.
- QA read-only is the default: writes require explicit disposable data scope.
- Never modify protected PlanID 5, personal history, paused sessions, or non-disposable data.
- Record environment, account type, record IDs, cleanup, and unresolved integrity questions.
