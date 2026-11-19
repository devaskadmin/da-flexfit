# Testing Strategy

## Priority

- Targeted tests for the changed component/domain.
- Backend `node --test` for backend changes.
- Frontend project-owned tests outside `node_modules`.
- Frontend production build for UI/build changes.
- Authenticated browser tests only with explicit disposable scope.

## Evidence classification

- PASS: observed actual result.
- FAIL: reproducible defect with evidence.
- BLOCKED: prerequisite, environment, authorization, or data availability prevented safe verification.
- PENDING VERIFICATION: implementation exists but no safe live evidence.
- USER ACCEPTANCE PENDING: implementation/live tested but not approved by the user.

Do not claim user acceptance from automated tests.
