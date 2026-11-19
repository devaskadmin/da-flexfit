# API Error Contracts

## General

- Express returns JSON errors for application routes where implemented.
- Authentication failures include unauthorized responses and login guidance.
- Validation failures should include a stable `error` message and may include `code`, `requestId`, or service fields.

## Important protected regression

Ordinary Workout Log history viewing must not POST `/api/workout-log/session`. Strict write validation, including `exercises array is required.`, remains intact.

## Session conflict contract

Workout session routes use conflict/limit codes such as `WORKOUT_SESSION_LIMIT_REACHED` and `WORKOUT_SESSION_CONFLICT` in frontend/backend source. Exact payloads should be documented only from observed responses and should remain UNVERIFIED where unavailable.
