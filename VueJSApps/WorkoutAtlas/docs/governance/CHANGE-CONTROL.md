# Change Control

## Risk levels

- LOW: documentation or formatting without runtime effect.
- MEDIUM: scoped application changes with tests.
- HIGH: authentication, authorization, database schema, session persistence, or media-contract work.
- CRITICAL: production deployment, destructive data changes, credential rotation, infrastructure changes, or security-boundary changes.

## Approval process

- State exact task scope and affected canonical docs.
- Identify protected data and rollback considerations.
- Review source diff and test evidence.
- Obtain user approval for HIGH/CRITICAL work.
- Treat user acceptance separately from automated pass.
