---
description: "Perform a read-only WorkoutAtlas database change impact review."
agent: "agent"
argument-hint: "Proposed SQL or migration request"
---

Read `docs/database/MIGRATION-POLICY.md`, relevant SQL, and API/schema docs.

- Perform no database connection or data modification unless separately approved.
- Identify backup, rollback, validation, affected tables, and API/code impact.
- Preserve workout history, sessions, and protected records.
- Report missing live metadata as UNVERIFIED.
