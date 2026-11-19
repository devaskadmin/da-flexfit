# Development Workflow

## Lifecycle

`INTAKE → DISCOVERY → APPROVAL → IMPLEMENTATION → TESTING → DOCUMENTATION → USER ACCEPTANCE → CLOSEOUT`

## Before implementation

1. Read root instructions and current state.
2. Confirm branch and working tree.
3. Inspect the relevant backlog item and source files.
4. Identify impact and protected data.
5. Obtain explicit authorization for writes, restarts, migrations, deployments, or destructive tests.

## Testing

Run targeted tests before broad suites. Reuse prior proven evidence unless a change invalidates it. Record actual counts and environment constraints.

## Closeout

Update DEVLOG, backlog, session handoff, relevant API/schema docs, and CHANGELOG when product behavior changes. Preserve separate pass/fail/blocked evidence.

## Repository publication safeguards

Before commit: review staged files and secret/private-information patterns. Before GitHub push: require explicit authorization, scan current tracked content and unpublished commits, and keep local-only paths excluded. No passing build implies repository publication safety.
