# Workout Business Rules

## Verified repository behavior

- Plans distinguish personal/community/global/featured and other repository-defined plan types.
- Sessions count unfinished/in-progress/paused states toward configured active-session limits.
- The backend implements a configured two-active-session limit in session source/tests.
- Workout history is separate from workout plan templates.
- Completed workout history date/display behavior uses date-only semantics.
- Protected PlanID 5 and existing paused sessions must not be mutated by QA.

## Pending live acceptance

- Published/draft plan transition persistence.
- Two-session third-start live replay.
- Featured registration copy and retry semantics.
