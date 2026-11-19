# Backend Architecture

## Stack

Node.js 22, Express 4, `mysql2`, Express sessions, Multer, and gateway HTTP integrations are defined in `backend/package.json` and source modules.

## Route registration

`backend/server.js` mounts authentication, users/plans, exercises, notifications, workout-log, workout-sessions, nutrition, media, AI gateway, dashboard, goals, and admin route modules.

## Data access

MySQL connection configuration is environment-based. Pool details and startup behavior are implemented in `backend/db.js`, `backend/dbConfig.js`, and `backend/server.js`.

## Authorization

Authentication and role checks are implemented in route modules and middleware. Frontend UI visibility is not a substitute for backend authorization.
