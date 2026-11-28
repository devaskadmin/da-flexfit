# WorkoutAtlas Versioning

## Package releases

Frontend and backend package versions currently use `0.85.308`. Main releases use custom three-part identifiers such as `0.85.309`.

The `0.85.cleanup` branch identifier (2026-11-24) is a work-branch label, not a release or package version; the inventory task made no version change. Task `0.85.cleanup.1` (controlled template feature removal) is likewise a task label, not a version; package versions remain `0.85.308`. Task `0.85.cleanup.1.a1` (Batch 1 template removal: CRM, HRM, e-commerce; 2026-11-25) is also a task label only and made no package version change. Tasks `0.85.cleanup.1.a2` (Batch 1 navigation investigation, read-only) and `0.85.cleanup.2` (Batch 2 template removal: chat, calendar, email, invoices, contacts, file manager; 2026-11-25) are likewise task labels only; package versions remain `0.85.308`. Task `0.85.cleanup.3` (Batch 3 template removal: unused authentication, pricing and email demonstration pages; 2026-11-25) is also a task label only and made no package version change. Task `0.85.cleanup.4` (Batch 4 template removal: unused Digiboard UI demonstrations; 2026-11-25) is likewise a task label only and made no package version change. Task `0.85.cleanup.5` (Batch 5 final unused template composable cleanup; 2026-11-25) is also a task label only and made no package version change. Tasks `0.85.cleanup.5.a1` (mobile and tablet navigation investigation, read-only) and `0.85.cleanup.5.a2` (mobile navigation performance targeted repair: `ProfileDropdown.vue` and `AppBottomNav.vue`; 2026-11-25) are likewise task labels only and made no package version change; `0.85.cleanup.5` failed mobile/tablet acceptance and final cleanup acceptance remains blocked. Task `0.85.cleanup.5.a3` (mobile and tablet navigation performance optimization: session request sharing, dashboard concurrency and redundant write removal; 2026-11-25) is likewise a task label only and made no package version change. The `0.85.cleanup` branch (all five batches, a2 and a3; merged into BETA on 2026-11-25 with owner authorisation and then retired) remains a work-branch label and made no package version change; package versions remain `0.85.308`.

Task `0.85.316.1` (move action buttons into section headers; `WorkoutBuilder.vue` layout only; 2026-11-25) is a task label only and made no package version change; packages remain `0.85.308`. Task `0.85.316.2` (Workout Plan Information two-column layout; 2026-11-25) is likewise a task label only and made no package version change. Sub-fix `0.85.316.2.a1` (two-column layout correction after owner rejection; 2026-11-25) is also a task label only; packages remain `0.85.308`. Task `0.85.316.3` (Workout Plan Information vertical accordions; 2026-11-25) is likewise a task label only and made no package version change. Sub-fix `0.85.316.3.a1` (accordion header colors; 2026-11-25) is also a task label only; packages remain `0.85.308`. Sub-fix `0.85.316.3.a2` (accordion header corners; 2026-11-25) is likewise a task label only; packages remain `0.85.308`. Sub-fix `0.85.316.3.a3` (accordion header border-radius override after a2 failed acceptance; 2026-11-25) is also a task label only; packages remain `0.85.308`. Sub-fix `0.85.316.3.a4` (single accordion expansion; 2026-11-25) is likewise a task label only; packages remain `0.85.308`. Task `0.85.316.4` (Schedule Planner horizontal week navigation; 2026-11-25) is also a task label only and made no package version change. Task `0.85.317` (Recording Type correction for saved plan exercises; 2026-11-25) is likewise a task label only and made no package version change. Task `0.85.318` (Add Day button color; 2026-11-25) is likewise a task label only and made no package version change. Task `0.85.320` (official 0.85 release closeout; 2026-11-25) is the milestone closeout label, owner accepted, and made no package version change; packages remain `0.85.308`. The next development milestone is `0.86`.

## Corrective identifiers

Corrective attempts use suffixes such as `0.85.307.a1`. These are release-tracking identifiers and are not necessarily npm package versions.

## Rules

- Documentation-only work does not advance package versions.
- Do not bump solely to mark a QA checkpoint.
- Critical unaccepted regressions prevent release closeout.
- Changelog, DEVLOG, QA evidence, backlog, and session handoff must reflect actual state separately.
- Package changes require explicit release authorization.

Task `0.85.323` (mobile logout confirmation correction; 2026-11-26) is a task label only and made no package version change; packages remain `0.85.308`.

Task `0.85.321` (missing active workout exercise cards correction; 2026-11-28) is a task label only and made no package version change; packages remain `0.85.308`.

Task `0.85.322` (mobile profile dropdown fix; 2026-11-28) is a task label only and made no package version change; packages remain `0.85.308`.
Task `0.85.324` (final maintenance checkpoint; 2026-11-28) is a task label only and made no package version change; packages remain `0.85.308`.

Task `0.85.325` (final maintenance audit and Render readiness review, including repair `0.85.321.a1`; 2026-11-28) is a task label only and made no package version change; packages remain `0.85.308`.

The owner authorized committing and pushing the `0.85.321`-`0.85.325` maintenance changes to `BETA` (2026-11-28; static readiness YES; Render build/runtime verification and manual acceptance pending). The next development milestone is `0.86` (not started).