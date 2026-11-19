# WorkoutAtlas Repository Instructions

Read `AGENTS.md`, `docs/INDEX.md`, `docs/engineering/CURRENT-STATE.md`, and `docs/backlog/BACKLOG.md` before repository work.

- Preserve the existing Vue 3/Vite and Express/MySQL architecture.
- Keep changes scoped and evidence-based.
- Do not modify protected PlanID 5 or existing personal workout/history/session data.
- Do not run migrations or mutate databases without explicit authorization.
- Do not restart servers, push, deploy, or change package versions unless explicitly requested.
- Documentation-only tasks must not alter application source or lockfiles.
- Update only affected canonical documents and link them from `docs/INDEX.md`.
- Report pass/fail/blocked distinctly; automated pass is not user acceptance.
- Before every commit, run staged-file and secret review and verify `.local-only/` and `.artifacts/` are excluded.
- Before every GitHub push, require explicit user authorization and pass repository security/history review.
- Never copy secret values into prompts, handoffs, generated Markdown, or reports.
- A passing build or clean Git status does not establish publication safety.
