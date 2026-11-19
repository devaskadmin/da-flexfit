# WorkoutAtlas API Catalog

**Status:** source-derived from registered Express routes; uncertain contracts remain marked UNVERIFIED.

## Authentication

| Method | Route | Purpose | Auth | Source |
|---|---|---|---|---|
| POST | `/api/login` | Authenticate username/email | Trusted origin/rate limit | `backend/api/auth.js` |
| POST | `/api/logout` | End session | Trusted origin | `backend/api/auth.js` |
| GET | `/api/session` | Current session state | Session; route behavior source-verified | `backend/api/auth.js` |
| POST | `/api/register` | Create account | Trusted origin/rate limit | `backend/api/auth.js` |
| POST | `/api/auth/google` | Google authentication | Trusted origin/rate limit | `backend/api/auth.js` |

## Workout plans

| Method | Route | Purpose | Auth/authorization | Source |
|---|---|---|---|---|
| POST | `/api/workout-schedules` | Create plan | Authenticated owner | `backend/api/users.js` |
| GET | `/api/workout-schedules/:id` | Read plan | Ownership/read policy | `backend/api/users.js` |
| PUT | `/api/workout-planner` | Save canonical planner payload | Ownership | `backend/api/users.js` |
| POST | `/api/workout-schedules/:id/plan-type-conversion-preview` | Preview plan copy/conversion | Role/source policy | `backend/api/users.js` |
| POST | `/api/workout-schedules/:id/plan-type-conversion` | Execute conversion | Role/source policy | `backend/api/users.js` |

Request/response shapes for individual plan routes are UNVERIFIED for a generated OpenAPI contract and should be treated from source implementation.

## Global and Featured plans

| Method | Route | Purpose | Auth/authorization |
|---|---|---|---|
| GET | `/api/featured-workout-plans` | Public Featured plans | Public |
| GET | `/api/global-workout-plans` | Published Global discovery | Public or authenticated discovery policy |
| POST | `/api/featured-workout-plans/:id/clone` | Copy Featured template | Authenticated registration/plan policy |
| GET/PATCH/POST/DELETE | `/api/admin/global-workout-plans*` | Admin Global plan management | Admin policy |

## Exercises

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/api/get-exercises` | Exercise retrieval | Auth-aware visibility |
| POST | `/api/save-exercises` | Create exercise | Role/scoped mutation |
| PUT | `/api/get-exercise/:id` | Update exercise | Owner/admin policy |
| DELETE | `/api/delete-exercise/:id` | Delete exercise | Owner/admin policy |

## Sessions

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/api/workout-sessions/in-progress` | List unfinished sessions | Authenticated |
| POST | `/api/workout-sessions/start` | Start/reuse session | Authenticated |
| POST | `/api/workout-sessions/:sessionId/pause` | Pause timer | Authenticated owner |
| POST | `/api/workout-sessions/:sessionId/resume` | Resume timer | Authenticated owner |
| POST | `/api/workout-sessions/complete/:sessionId` | Complete session | Authenticated owner |

## Workout history

- Mount: `/api/workout-log`.
- History GET: `/api/workout-log/history`.
- History correction PUT: `/api/workout-log/history/session/:sessionId`.
- History deletion DELETE: `/api/workout-log/history/session/:sessionId`.
- `/api/workout-log/session` remains a session-write endpoint and must not be invoked by ordinary history viewing.

## Media

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/media/default-exercise-image` | Default exercise fallback |
| GET | `/api/media/exercises/:exerciseId/image` | Exercise image |
| GET | `/api/media/default-workout-plan-image` | Default plan cover fallback |
| GET | `/api/media/workout-plans/:planId/cover` | Authorized plan cover |

## AI integration

- POST `/api/ai/qa-message` is mounted in `backend/api/ai-gateway.js` and requires authenticated use according to route source.
