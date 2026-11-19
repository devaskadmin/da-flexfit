# AI Gateway Integration

## Source

- Backend proxy: `backend/api/ai-gateway.js`
- Server mount: `/api` in `backend/server.js`
- Environment: gateway URL configuration is held in backend environment variables

## Boundary

The browser communicates with the Express backend. Gateway credentials and HMAC or trust configuration must not be exposed in frontend code or documentation.

## Operational status

Live gateway availability is environment-dependent and is not assumed from repository configuration alone.
