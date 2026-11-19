# Frontend Architecture

## Stack

Verified package dependencies: Vue 3.5, Vite 4.4, Vue Router, Pinia, Vue I18n, Bootstrap 5, FullCalendar, and ApexCharts.

## Structure

- `frontend/src/views/` contains guest/member route surfaces.
- `frontend/src/components/` contains reusable UI and workout components.
- `frontend/src/router/` contains route configuration and guards.
- `frontend/src/services/` and `frontend/src/composable/` contain API/state integration.
- `frontend/src/utils/` contains focused helpers such as date and preview behavior.

## API integration

`frontend/src/config/env.js` is the source-backed API base resolver. Development defaults to `http://localhost:5000`; production fallback is `https://api.workoutatlas.com`.

## Mobile behavior

The application uses responsive layouts and a bottom navigation surface. 390px and 800px live geometry were previously verified for key workout and plan screens. Real-device acceptance remains outside repository-only evidence.
