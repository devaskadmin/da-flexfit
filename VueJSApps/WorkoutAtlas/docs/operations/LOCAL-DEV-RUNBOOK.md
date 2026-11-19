# Local Development Runbook

## Verified local endpoints

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Frontend API base: `http://localhost:5000` in local development configuration

## Starting services

Start/restart requires explicit authorization. Existing package scripts:

- Backend: `npm run dev:backend` in `backend/`
- Combined backend/frontend: `npm run dev` in `backend/`
- Frontend: `npm run dev` in `frontend/`

## Safety

- Check ports before starting.
- Do not restart long-running services for documentation work.
- Preserve the existing browser authentication session when testing.
