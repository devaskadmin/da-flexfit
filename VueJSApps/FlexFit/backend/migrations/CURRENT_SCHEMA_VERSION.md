# FlexFit – Current Schema Version

**Schema Version:** v0.82.42  
**Latest Migration Date:** 2026-05-27  
**Maintained By:** Dev Asterisks LLC

---

## Applied Systems

| System | Status | Latest Migration |
|---|---|---|
| Workout Logging | ✅ Active | `20260527_workout_sessions.sql` |
| Cardio Support | ✅ Active | `20260527_workout_log_sets_cardio_fields.sql` |
| Workout Day Ordering | ✅ Active | `20260527_workout_log_day_ordering.sql` |
| Workout History Indexing | ✅ Active | `20260527_workout_history_index.sql` |
| Workout Planner Ordering | ✅ Active | `20260527_workout_planner_ordering_columns.sql` |
| Exercise Ownership | ✅ Active | `20260527_exercise_ownership.sql` |
| Dashboard Metrics | ✅ Active | `20260527_dashboard_metrics.sql` |
| Dashboard Metric Queries | ✅ Active | `20260527_dashboard_metric_queries.sql` |
| Progress Stats | ✅ Active | `20260527_progress_stats.sql` |
| Notifications | ✅ Active | `20260527_notifications_schema.sql` |
| Core | 🔲 Placeholder | — |
| Nutrition | 🔲 Placeholder | — |
| AI | 🔲 Placeholder | — |

---

## Migration Folder Map

```
backend/migrations/
├── core/          # Core user/auth schema changes
├── workout/       # Workout logging, sessions, planner
├── nutrition/     # Nutrition tracking (future)
├── security/      # Ownership, RBAC, access control
├── dashboard/     # Dashboard metrics, notifications, stats
├── ai/            # AI feature migrations (v0.85+)
└── archive/       # One-off backfills, deprecated patches
```

---

## Known Dependencies

- `workout_log_sessions` depends on `users`
- `workout_log` depends on `workout_log_sessions`, `exercises`
- `workout_schedule_groups` depends on `workout_schedules`
- `exercises` ownership depends on `users` (CreatedByUserID FK)
- `user_favorite_exercises` depends on `users` and `exercises`
- `notifications` depends on `users`
- `notification_preferences` depends on `users`

---

## Canonical Schema Files

Located in `backend/schema/`:

| File | Purpose |
|---|---|
| `exercises_schema.sql` | Full exercise table bootstrap + ownership columns |
| `workout_schedule_schema.sql` | Workout schedule + schedule groups schema |
| `base_schema.sql` | Full baseline schema (initial deploy / fresh install) |
| `seed_data.sql` | Default seed records (roles, lookup values) |
| `demo_accounts.sql` | Demo user accounts for development/staging |
| `lookup_tables.sql` | Lookup/reference tables (exercise categories, muscle groups, etc.) |

---

## Upcoming

- `v0.83` – Feature expansion migrations (TBD)
- `v0.85` – AI feature migrations → `backend/migrations/ai/`
