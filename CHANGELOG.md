# Changelog

## 0.2.0 — 2026-10-29

### Added

- CSV/JSON import previews for video and daily channel reports.
- Working analytics summaries, daily views chart, date filters and searchable/sortable/paginated libraries.
- Workspace-isolated snapshots, duplicate detection and source/period visibility.
- Automatic schema-1 migration with recovery backup; imported-data backup/restore.

### Fixed

- Date-range endpoints stay consistent when the start moves past the end.
- Cached Electron archives can be used for offline packaging after checksum verification.

### Scope

- Manual imports only. Live YouTube sign-in and other creator tools remain planned.

## 0.1.0 — 2026-10-28

### Added

- Local macOS workspaces with restart persistence.
- Light/dark/system appearance, workspace navigation and storage settings.
- Backup export, validated restore previews and recovery backups.
- Sandboxed desktop host and Apple Silicon app packaging.

### Preview scope

- Desktop-core only. Channel data, analytics, research, creative tools and live YouTube connection are not implemented yet.
- Local ad-hoc signing; no Developer ID signing, notarization, Intel or Windows verification.
