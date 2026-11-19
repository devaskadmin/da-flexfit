# WorkoutAtlas

WorkoutAtlas is a Vue 3/Vite workout application with an Express/Node.js API and MySQL persistence.

## Development entry points

- Repository agent contract: [AGENTS.md](AGENTS.md)
- Documentation index: [docs/INDEX.md](docs/INDEX.md)
- Current state: [docs/engineering/CURRENT-STATE.md](docs/engineering/CURRENT-STATE.md)
- Session handoff: [docs/engineering/SESSION-HANDOFF.md](docs/engineering/SESSION-HANDOFF.md)
- Product changelog: [CHANGELOG.md](CHANGELOG.md)
- Historical batch QA evidence: [WORKOUTATLAS_BATCH_RESULTS.md](WORKOUTATLAS_BATCH_RESULTS.md)

## Runtime

Frontend: local Vite development server on port 5173.
Backend: Express on port 5000.
Database: MySQL configured through backend environment variables.

Use [docs/operations/LOCAL-DEV-RUNBOOK.md](docs/operations/LOCAL-DEV-RUNBOOK.md) before starting or restarting services.
