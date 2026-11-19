# Database Migration Policy

## Rules

1. Schema changes require an approved migration artifact and scoped request.
2. A migration must be reviewed before execution.
3. Backup and rollback requirements must be stated before hosted execution.
4. Preserve workout templates, sessions, history, and protected accounts.
5. Local development databases must be separated from production where possible.
6. Update schema, data dictionary, relationships, API contracts, and release evidence when contracts change.
7. Destructive operations require explicit authorization.

## Execution approval

No migrations or data mutations are authorized under documentation or QA-only work. Read-only schema review and SQL artifact review are allowed.

## Safe migration characteristics

- Prefer forward-only/idempotent changes where practical.
- Preserve enum values and existing rows.
- Avoid dropping or recreating tables for simple column additions.
- Use validation and rollback scripts where provided.
- Record backup evidence and rollback execution instructions.
