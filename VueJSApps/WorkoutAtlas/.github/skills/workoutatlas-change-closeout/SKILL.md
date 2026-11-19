---
name: workoutatlas-change-closeout
description: "Use for closing an authorized WorkoutAtlas implementation task, validating evidence, updating canonical docs, and preparing a handoff."
argument-hint: "Task ID and target version"
---

# WorkoutAtlas Change Closeout

1. Read current state and session handoff.
2. Review git diff and protected-data constraints.
3. Run only relevant tests/build.
4. Update DEVLOG and backlog.
5. Update session handoff.
6. Update API/schema/architecture docs only for contract changes.
7. Update CHANGELOG only for product behavior changes.
8. Record commit details if an approved commit is made.
9. Do not claim user acceptance; leave acceptance pending if unresolved.
