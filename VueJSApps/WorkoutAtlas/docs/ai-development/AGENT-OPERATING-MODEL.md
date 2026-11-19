# AI Agent Operating Model

## Lifecycle

`INTAKE → DISCOVERY → APPROVAL → IMPLEMENTATION → TESTING → DOCUMENTATION → USER ACCEPTANCE → CLOSEOUT`

## Before implementation

- Read `AGENTS.md`, current state, session handoff, and backlog.
- Inspect relevant source and existing evidence.
- Confirm branch/HEAD and working tree.
- Determine risk and required approvals.
- Use disposable data or isolated environments for write tests.

## During implementation

- Preserve scope and existing behavior.
- Avoid speculative refactoring.
- Add targeted regression coverage.
- Record blockers separately from defects.
- Never claim success without evidence.

## Before closeout

- Review diff and test evidence.
- Update DEVLOG, backlog, session handoff, and affected contracts.
- Update CHANGELOG for product behavior changes.
- Record commit details.
- Identify user acceptance separately.
