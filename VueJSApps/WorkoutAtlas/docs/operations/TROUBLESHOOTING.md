# Troubleshooting

## Frontend unreachable

Check port 5173, Vite process, and frontend environment configuration. Do not restart without approval.

## Backend unreachable

Check port 5000, backend process, database environment variables, and session/CORS configuration. Do not restart or modify infrastructure without approval.

## API unauthorized

Check browser session, trusted origin, cookie settings, and backend route authentication. Do not weaken authorization to resolve local QA.

## Media unavailable

Verify the backend media route and gateway environment. Do not bypass gateway delivery or change infrastructure without approval.
