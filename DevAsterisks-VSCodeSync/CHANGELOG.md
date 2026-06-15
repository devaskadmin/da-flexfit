# Changelog

All notable changes to this project are documented in this file.

## [1.0.1] - 2026-03-21

### Changed
- Renamed default sample config file from `config/example-config.json` to `config/synctool-ftp-settings.json` (content unchanged).
- Updated startup default config path in `main.py` to use `synctool-ftp-settings.json`.
- Version/build branding finalized at `1.0` in app UI and default configuration.

## [1.0.0] - 2026-03-21

### 🚀 Full Release Highlights
- Production-ready desktop FTP sync app with modern CustomTkinter UI.
- Multi-profile configuration support via JSON.
- Reliable manual sync operations (`Test`, `Push`, `Pull`) with background threading.
- Live auto-sync with local change tracking and periodic bidirectional reconciliation.
- Legacy FTP compatibility improvements and detailed diagnostics.

### Added
- Modular app architecture:
  - `main.py` entrypoint
  - `app/config_manager.py`
  - `app/ftp_client.py`
  - `app/sync_coordinator.py`
  - `app/local_watcher.py`
  - `app/remote_watcher.py`
  - `app/gui.py`
  - `app/logger.py`
  - `app/models.py`
  - `app/utils.py`
- JSON-based configuration model with app metadata and profile definitions.
- Native top menu:
  - `File` → `Load Configuration...`, `Exit`
  - `Navigate` → `Dashboard`, `Connections`, `Activity Log`
  - `Help` → `About`
- JSON-only file picker and guarded config loading flow.
- Profile search and status filtering (`all`, `idle`, `watching`, `error`).
- Pull progress updates in UI (e.g., processed/downloaded counters).
- Auto-sync controls per profile (`Start/Stop Auto`).
- Pending upload tracking and dashboard counters.
- Horizontal + vertical scrolling support for wide/tall profile lists.

### Improved
- Professional dark-themed dashboard layout.
- View-based navigation behavior:
  - Dashboard view shows top summary chips + configuration section.
  - Connections view prioritizes profile operations with large scroll area.
  - Activity Log view focuses on runtime logs.
- Wider, more scalable connection row layout to keep actions accessible.
- Better profile card clarity (protocol badge, status, pending count, actions).

### Sync Engine Enhancements
- Smarter file comparison using size + modified time with tolerance logic.
- Exclude pattern consistency across push/pull/auto-sync workflows.
- Local polling watcher for file changes.
- Periodic bidirectional reconciliation cycle:
  - Upload local files missing on remote.
  - Download remote files missing locally.
  - Resolve changed files by timestamp-based newer-side sync.
  - Remove local files that were deleted remotely (remote-mirror behavior).

### FTP/FTPS Enhancements
- Explicit FTPS support (`FTP_TLS`) with optional certificate verification toggle.
- Passive mode support via configuration.
- Better FTP path diagnostics for `550` directory errors.
- MLSD-first remote listing with automatic fallback to legacy commands (`NLST`, `SIZE`, `MDTM`) for older servers.

### Error Handling & Observability
- Improved error propagation to UI and log file.
- Rich contextual logging (`profile`, `file`, `pending`, `error`, etc.).
- Last-result status panel and dialog feedback for failed operations.

### Configuration
- Added/extended profile options:
  - `protocol` (`ftp`, `ftpes`, `ftps`)
  - `verifyTlsCertificate`
  - `passiveMode`
  - `pollIntervalSeconds`
  - `uploadFileSyncInterval`
- Updated sample configuration to app version `0.9` during pre-1.0 hardening cycle.

### Notes
- This 1.0 release consolidates all beta improvements into a stable baseline for daily FTP sync workflows in VS Code-centric development environments.
- Recommended next milestone: configurable sync policies (`twoWay`, `remoteMirror`, `localMirror`) per profile.
