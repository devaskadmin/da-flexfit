# Documentation Standards

## Required structure

Important canonical documents should contain:

- Purpose
- Status
- Last verified date when known
- Source-of-truth references
- Related documents

## Naming

Use clear uppercase canonical names for major references and concise lowercase filenames only where existing conventions require.

## Synchronization

- Product behavior: `CHANGELOG.md`
- Technical implementation: `docs/engineering/DEVLOG.md`
- API contract: `docs/api/API-CATALOG.md`
- Database contract: `docs/database/SCHEMA.md` and data dictionary
- Architecture decision: ADR under `docs/architecture/decisions/`
- Test outcome: `docs/qa/`
- Backlog: `docs/backlog/BACKLOG.md`
- Current work: `CURRENT-STATE.md` and `SESSION-HANDOFF.md`

## Quality checks

- Relative links resolve to existing files.
- No secret values or unnecessary personal data.
- Versions and commits are traceable.
- Contradictions are identified, not silently resolved.
