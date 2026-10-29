# Desktop core implementation

The user approved the specification and explicitly requested coding on October 28, 2026. Proceed through these slices without additional planning gates.

1. Bootstrap Electron/React/TypeScript tooling and isolated test commands.
2. Implement and test SQLite workspace transactions, typed settings and restart persistence.
3. Implement and test bounded backup validation, consistent snapshots, staged restore and rollback.
4. Connect a sandboxed preload bridge, protected credential service and native app lifecycle.
5. Build the accessible workspace/settings UI and honest planned-feature states.
6. Verify a real Electron instance, package arm64 DMG/ZIP, test a copied package, and document evidence/limitations.

Use Node's built-in SQLite binding if supported by the selected Electron runtime; verify that before packaging. It avoids a third-party native ABI dependency. Backups use a bounded JSON container holding a SQLite snapshot and its hash (no archive extraction), which eliminates archive traversal/symlink extraction. This core contains no attachments yet; module attachments require a later format revision.

Design: warm neutral canvas, dark teal accent, compact left navigation, restrained typography, native window controls. Empty states explain the next actionable step; no simulated analytics. Settings is the functional center of this module.

# 0.2.0 imports and dashboard

Completed: bounded CSV/JSON parser and fixtures; typed report contracts; schema-2 transaction and recovery migration; workspace-owned snapshot persistence/deduplication; report queries; native preview/commit bridge; working dashboard, library, daily chart and filters; old-backup compatibility; real packaged-app checks; versioned deliverables. Live synchronization remains the next module boundary requiring Google application configuration.
