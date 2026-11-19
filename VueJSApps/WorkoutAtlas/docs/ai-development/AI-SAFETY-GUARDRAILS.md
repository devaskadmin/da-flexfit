# AI Safety Guardrails

| Operation | Default policy |
|---|---|
| Read source/docs/history | Allowed |
| Update approved documentation | Allowed |
| Run non-mutating tests/build | Allowed |
| Edit application code | Requires task authorization |
| Create or modify test records | Requires explicit disposable data scope |
| Delete database records | Requires explicit authorization |
| Start/restart servers | Requires authorization |
| Database migration | Requires explicit authorization |
| Git local commit | Only approved workflow |
| Git push | Explicit authorization |
| Render deployment | Explicit authorization |
| Gateway/infrastructure change | Explicit authorization |

A request to “test the application” is not blanket destructive authorization.

## Critical protected data

- PlanID 5 — Stephen K – Lean Muscle.
- Existing personal workout history.
- Existing paused sessions.
- Non-disposable Global plans.
- Existing production accounts.

If disposal cannot be proven, do not delete or mutate the record.

## Repository publication safeguards

Before commit: review staged paths/diff, secret patterns, private paths, `.local-only/`, `.artifacts/`, and environment overrides.

Before push: explicit user authorization is mandatory. Review unpublished commits, pass the local security gate, and remediate unresolved critical findings. Gitignore and passing application tests do not prove repository publication safety.
