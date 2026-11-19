# WorkoutAtlas Versioning

## Package releases

Frontend and backend package versions currently use `0.85.308`. Main releases use custom three-part identifiers such as `0.85.309`.

## Corrective identifiers

Corrective attempts use suffixes such as `0.85.307.a1`. These are release-tracking identifiers and are not necessarily npm package versions.

## Rules

- Documentation-only work does not advance package versions.
- Do not bump solely to mark a QA checkpoint.
- Critical unaccepted regressions prevent release closeout.
- Changelog, DEVLOG, QA evidence, backlog, and session handoff must reflect actual state separately.
- Package changes require explicit release authorization.
