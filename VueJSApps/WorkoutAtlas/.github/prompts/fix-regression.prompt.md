---
description: "Repair an identified WorkoutAtlas regression with a scoped root-cause fix and regression coverage."
agent: "agent"
argument-hint: "Parent version, corrective suffix, reproduction, expected behavior"
---

Use `AGENTS.md`, `docs/engineering/CURRENT-STATE.md`, and the parent corrective evidence.

- Reproduce only inside the approved environment.
- Identify the exact root cause and smallest affected area.
- Add targeted regression coverage.
- Verify the original failure and inspect protected-data behavior.
- Document the corrective version in DEVLOG and backlog.
- Do not advance package versions or release acceptance without authorization.
