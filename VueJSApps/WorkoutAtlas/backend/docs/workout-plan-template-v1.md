# WorkoutAtlas 0.85.183 - Plan Template v1

## Scope

This document defines the canonical WorkoutAtlas workout plan template format for:
- Plan duplication
- Plan type conversion
- JSON export/import
- Shared templates
- AI-generated plan input

No database writes are required for this module.

## Canonical Template Envelope

```json
{
  "format": "workoutatlas.plan",
  "schemaVersion": 1,
  "exportedAt": "2026-11-01T20:00:00.000Z",
  "template": {
    "metadata": {
      "name": "Beginner Strength",
      "description": "4-week plan",
      "workoutType": "Strength",
      "category": "General Fitness",
      "planType": "personal",
      "estimatedSessionMinutes": 45,
      "planDurationWeeks": 4
    },
    "publication": {
      "status": "draft",
      "visibility": "private",
      "featured": false
    },
    "goals": {
      "goalType": "exercise_weight",
      "goalId": "17",
      "targetDate": "2026-12-31",
      "context": {
        "goalType": "exercise_weight",
        "exerciseId": 18,
        "exerciseName": "Bench Press",
        "targetValue": 225,
        "targetUnit": "lb",
        "targetDate": "2026-12-31",
        "status": "active"
      }
    },
    "coverImage": {
      "assetRefType": "public_url",
      "uri": "https://cdn.example.com/covers/plan-001.jpg",
      "mediaType": "image"
    },
    "schedule": {
      "mode": "day",
      "dayGroups": [{ "label": "Day 1", "order": 1 }],
      "weekGroups": [{ "label": "Week 1", "order": 1 }],
      "exercises": [
        {
          "order": 1,
          "groupLabel": "Day 1",
          "exercise": {
            "referenceId": 101,
            "name": "Bench Press",
            "imageUrl": "https://...",
            "workoutType": "Strength",
            "muscleGroup": "Chest",
            "equipment": "Barbell",
            "recordingType": "sets_reps"
          },
          "targets": {
            "sets": 4,
            "reps": 8,
            "weightLbs": 185,
            "durationMinutes": null,
            "distanceMiles": null,
            "calories": null,
            "restSeconds": 90
          },
          "notes": "Explosive concentric",
          "extensions": {}
        }
      ]
    },
    "extensions": {}
  }
}
```

## Field Mapping (Current System -> Template)

### Frontend model sources
- `frontend/src/views/Member/WorkoutBuilder.vue`
  - `metadata.name` -> `template.metadata.name`
  - `metadata.description` -> `template.metadata.description`
  - `metadata.type` -> `template.metadata.workoutType`
  - `metadata.category` -> `template.metadata.category`
  - `metadata.planType` -> `template.metadata.planType`
  - `metadata.estimatedDuration` -> `template.metadata.estimatedSessionMinutes`
  - `metadata.planDurationWeeks` -> `template.metadata.planDurationWeeks`
  - `metadata.goalType` -> `template.goals.goalType`
  - `metadata.goalTargetDate` -> `template.goals.targetDate`
  - `metadata.goalId` -> `template.goals.goalId`
  - `metadata.goalContext` -> `template.goals.context`
  - `status` -> `template.publication.status`
  - `visibility` -> `template.publication.visibility`
  - `isFeatured` or `planType===featured` -> `template.publication.featured`
  - `scheduleMode` -> `template.schedule.mode`
  - `dayGroups/dayGroupOrders` -> `template.schedule.dayGroups[]`
  - `weekGroups/weekGroupOrders` -> `template.schedule.weekGroups[]`
  - `exercises[].scheduleGroup` -> `template.schedule.exercises[].groupLabel`
  - `exercises[].sortOrder` -> `template.schedule.exercises[].order`
  - `exercises[].exerciseId` -> `template.schedule.exercises[].exercise.referenceId`
  - `exercises[].name` -> `template.schedule.exercises[].exercise.name`
  - `exercises[].image` -> `template.schedule.exercises[].exercise.imageUrl`
  - `exercises[].workoutType` -> `template.schedule.exercises[].exercise.workoutType`
  - `exercises[].muscleGroup` -> `template.schedule.exercises[].exercise.muscleGroup`
  - `exercises[].equipment` -> `template.schedule.exercises[].exercise.equipment`
  - `exercises[].recordingType` (or inferred) -> `template.schedule.exercises[].exercise.recordingType`
  - `exercises[].sets/reps/weight` -> `template.schedule.exercises[].targets.sets/reps/weightLbs`
  - `exercises[].duration/distance/calories` -> `template.schedule.exercises[].targets.durationMinutes/distanceMiles/calories`
  - `exercises[].restTime` -> `template.schedule.exercises[].targets.restSeconds`
  - `exercises[].notes` -> `template.schedule.exercises[].notes`

### Backend model sources
- `backend/api/users.js`
  - `buildPlannerFromSchedule()` output is directly consumable by serializer
  - `normalizePlannerPayload()` output is compatible with deserializer target payload

### MySQL sources (current schema/migrations)
- `workout_schedules`
  - `title`, `description`, `workout_type`, `category`, `workout_plan_type`
  - `estimated_duration_minutes`, `plan_duration_weeks`
  - `goal_type`, `goal_target_date`, `linked_goal_id`
  - `status`, `visibility`, `schedule_mode`
  - `cover_image_*` metadata (private, not exported directly)
- `workout_schedule_groups`
  - `label`, `group_type`, `sort_order`, `workout_log_display_order`
- `workout_schedule_exercises`
  - `exercise_id`, `exercise_name`, `exercise_image_url`
  - `workout_type`, `muscle_group`, `equipment`
  - `sort_order`, `notes`
  - `target_sets`, `target_reps`, `target_weight`
  - `target_duration_minutes`, `target_distance_miles`, `target_rest_seconds`

## Security/Privacy Rules

Public template exports must not include:
- User IDs
- Session/auth data
- Passwords/tokens
- Private storage keys (e.g. `APP/workout-plans/...`)
- Internal DB IDs not needed for cross-environment portability

## Known Mapping Gaps (0.85.183)

1. `targets.calories` is represented in template but has no dedicated DB persistence column.
2. Portable cover references are represented, but current backend does not expose a public cover URL from `cover_image_storage_key`.

## SQL Migration Notes (Not executed)

If full persistence parity is required in 0.85.184:
1. Add `target_calories` to `workout_schedule_exercises`.
2. Add a public cover media reference strategy (signed URL resolver or media alias) that can be exported without exposing storage keys.
