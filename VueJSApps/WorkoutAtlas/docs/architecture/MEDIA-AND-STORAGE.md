# Media and Storage

## Confirmed repository behavior

- Exercise media: `backend/api/media.js` exposes `/api/media/exercises/:exerciseId/image` and default fallback routes.
- Workout plan covers: `/api/media/workout-plans/:planId/cover` and default-plan-cover fallback are registered.
- Storage resolution is implemented through `backend/services` and media/gateway modules.
- Gateway-only exercise delivery is documented in existing batch evidence and source tests.

## Safety

- Do not bypass the gateway for local media delivery.
- Do not modify gateway, HMAC, Tailscale, Docker, or storage infrastructure without explicit authorization.
- Missing-media behavior should use existing fallback behavior.

Live gateway status is environment-dependent and must not be claimed operational from source alone.
