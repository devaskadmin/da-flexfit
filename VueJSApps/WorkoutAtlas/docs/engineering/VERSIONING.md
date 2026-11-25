# WorkoutAtlas Versioning

## Package releases

Frontend and backend package versions currently use `0.85.308`. Main releases use custom three-part identifiers such as `0.85.309`.

The `0.85.cleanup` branch identifier (2026-11-24) is a work-branch label, not a release or package version; the inventory task made no version change. Task `0.85.cleanup.1` (controlled template feature removal) is likewise a task label, not a version; package versions remain `0.85.308`. Task `0.85.cleanup.1.a1` (Batch 1 template removal: CRM, HRM, e-commerce; 2026-11-25) is also a task label only and made no package version change. Tasks `0.85.cleanup.1.a2` (Batch 1 navigation investigation, read-only) and `0.85.cleanup.2` (Batch 2 template removal: chat, calendar, email, invoices, contacts, file manager; 2026-11-25) are likewise task labels only; package versions remain `0.85.308`. Task `0.85.cleanup.3` (Batch 3 template removal: unused authentication, pricing and email demonstration pages; 2026-11-25) is also a task label only and made no package version change. Task `0.85.cleanup.4` (Batch 4 template removal: unused Digiboard UI demonstrations; 2026-11-25) is likewise a task label only and made no package version change. Task `0.85.cleanup.5` (Batch 5 final unused template composable cleanup; 2026-11-25) is also a task label only and made no package version change. Tasks `0.85.cleanup.5.a1` (mobile and tablet navigation investigation, read-only) and `0.85.cleanup.5.a2` (mobile navigation performance targeted repair: `ProfileDropdown.vue` and `AppBottomNav.vue`; 2026-11-25) are likewise task labels only and made no package version change; `0.85.cleanup.5` failed mobile/tablet acceptance and final cleanup acceptance remains blocked. Task `0.85.cleanup.5.a3` (mobile and tablet navigation performance optimization: session request sharing, dashboard concurrency and redundant write removal; 2026-11-25) is likewise a task label only and made no package version change. The `0.85.cleanup` branch (all five batches, a2 and a3; merged into BETA on 2026-11-25 with owner authorisation and then retired) remains a work-branch label and made no package version change; package versions remain `0.85.308`.

## Corrective identifiers

Corrective attempts use suffixes such as `0.85.307.a1`. These are release-tracking identifiers and are not necessarily npm package versions.

## Rules

- Documentation-only work does not advance package versions.
- Do not bump solely to mark a QA checkpoint.
- Critical unaccepted regressions prevent release closeout.
- Changelog, DEVLOG, QA evidence, backlog, and session handoff must reflect actual state separately.
- Package changes require explicit release authorization.
