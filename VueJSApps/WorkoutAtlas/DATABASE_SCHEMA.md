# FlexFit / WorkoutAtlas Database Schema — Compatibility Entry Point

**Compatibility status:** retained for existing repository consumers.

The root overview previously identified application version `0.7.1-beta`. That version is not the current application package version and is not authoritative for the current repository.

Use the maintained source-backed references:

- [Canonical schema reference](docs/database/SCHEMA.md)
- [Data dictionary](docs/database/DATA-DICTIONARY.md)
- [Relationships](docs/database/RELATIONSHIPS.md)
- [Migration policy](docs/database/MIGRATION-POLICY.md)
- [Repository migration registry](backend/migrations/CURRENT_SCHEMA_VERSION.md)

## Repository schema sources

- `backend/schema/base_schema.sql`
- `backend/schema/exercises_schema.sql`
- `backend/schema/workout_schedule_schema.sql`
- `backend/schema/lookup_tables.sql`
- `backend/schema/seed_data.sql`
- `backend/migrations/`

Live database metadata was not introspected for this documentation update. Table and column claims in the canonical documents must be validated against repository SQL and authorized live metadata before destructive work.
