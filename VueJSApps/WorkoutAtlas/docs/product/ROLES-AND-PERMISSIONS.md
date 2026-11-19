# Roles and Permissions

## Repository evidence

- Demo member, trainer, and admin UI sessions were live-tested for role visibility.
- Member Create Plan did not expose Global Plan creation.
- Trainer and admin Create Plan views exposed Global Plan options.
- Backend authorization must remain independent of frontend visibility.

## Pending live verification

- Admin/trainer/member write authorization for Global plans.
- Featured mark/unmark permission.
- ExerciseScope CUSTOM/SHARED/SYSTEM mutation permissions.

No role permission should be claimed from UI behavior alone.
