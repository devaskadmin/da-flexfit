---
name: WorkoutAtlas Database
description: "Use for MySQL schema, migrations, SQL review, data relationships, and database change impact."
applyTo: ["backend/schema/**", "backend/migrations/**", "docs/database/**"]
---

- Read `docs/database/MIGRATION-POLICY.md` before SQL work.
- No live introspection or production database write is allowed without explicit authorization.
- Prefer reversible, reviewed migrations and preserve workout history/sessions.
- Update schema, data dictionary, and relationship docs for contract changes.
