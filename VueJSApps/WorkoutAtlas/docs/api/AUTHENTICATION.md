# Authentication and Session Handling

## Verified behavior

- Express authentication routes are in `backend/api/auth.js`.
- Login/logout/register and Google authentication use trusted-origin/rate-limit middleware where defined.
- Sessions are issued through Express session middleware with MySQL session-store support.
- Frontend uses credentials for authenticated API calls.

## Environment behavior

Local and production cookie configuration differs. Production-only values must remain environment-owned and must not be published in documentation.

## Authorization rule

Frontend role visibility does not confer backend permissions. Route middleware and database ownership checks are authoritative.
