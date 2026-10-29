# Creator Desk 0.2.0

An installable, local macOS app for importing and exploring creator analytics. This stage adds useful channel reporting to the desktop foundation; live Google/YouTube synchronization and research/AI tools remain planned.

## Working features

- Preview and import English YouTube Studio video-table and daily CSV exports; JSON arrays with equivalent fields also work.
- See views, watch hours, net subscriber change and impressions when supplied. Missing metrics remain unavailable rather than becoming zero.
- Search, sort and paginate the video library or daily records.
- Chart daily views and filter the metric date range of daily reports.
- Keep reports as separate workspace-owned snapshots; identical re-imports are deduplicated. Overlapping snapshots are never summed.
- Preserve local data through restarts and backup/restore.
- Upgrade existing 0.1 workspace databases automatically after saving a recovery backup; restore old schema-1 backups too.
- Existing appearance, workspace and protected desktop behavior remains available.

## Import a Studio export

In YouTube Studio, go to Analytics → Advanced mode, choose the reporting period, then Export current view → CSV. Unzip the export and select a video table or a daily channel report inside Creator Desk's Dashboard → Import report.

For video tables, enter the period used in Studio or explicitly select unknown/lifetime. A publication date is not the date on which views occurred. Video-table exports provide period totals, so arbitrary metric date filtering is offered only for daily reports.

Supported English fields: Content (or Video ID/id), Video title/title, Video publish time/published, Date, Views, Watch time (hours)/watchHours, Subscribers, Impressions. Views and the report identity columns are required. English decimals are supported, including quoted thousands separators. ISO dates and English dates such as Oct 10, 2026 are accepted. CSV quoting, multiline titles, BOM, CRLF, comma/tab/semicolon delimiters, and UTF-8/UTF-16 input are handled. Unsupported columns are disclosed and ignored.

JSON input is an array of objects using the same field names, for example:

```json
[
  {
    "Date": "2026-10-01",
    "Views": 100,
    "Watch time (hours)": 5.5,
    "Subscribers": 2
  }
]
```

Google documents that Studio exports can be limited to 500 rows. A report note appears for large exports or when a supplied Total differs from the included rows. Dashboard figures are explicitly the matching imported-row totals, not a claim of complete live channel totals. [Official export help](https://support.google.com/youtube/answer/9717005).

Example files under tests/fixtures contain fictional test figures. The app never seeds those figures into your real workspaces.

## Local data and limits

Data stays in ~/Library/Application Support/Creator Desk unless an absolute CREATOR_DESK_DATA_DIR is supplied for isolated testing. No report data is sent to a server. Native file selection is the only renderer route to importing files; it cannot submit arbitrary filesystem paths or SQL.

Preview limits: 8 MB input; 20,000 data records and 100 columns per file; 200 saved reports / 16 MB of normalized report payloads across the local database. Backup format 1 holds the SQLite snapshot/settings, up to 24 MB database / 32 MB file, excluding credential files and media attachments. The report library does not yet include report deletion or metadata editing; re-import corrected metadata as a separate snapshot. Preview tokens expire after 15 minutes and are bound to their workspace.

Migration from schema 1 saves a before-schema-2 recovery backup and updates transactionally. A failed migration preserves the prior schema. A newer schema is never silently downgraded. Imported reports are validated as part of backup inspection and included in backup/restore. Recovery backups are retained in the data directory's backups folder until removed manually.

## Build and test

Node 22.23.4+ and npm 12.2.1 were used. Dependencies remain unchanged from 0.1; exact versions are pinned in the lockfile.

```sh
npm ci
npm run bootstrap
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run make -- --arch=arm64
```

Dependency scripts stay disabled in .npmrc. Bootstrap runs only the reviewed Electron downloader. Packaging reuses the cached archive after verifying its published checksum, when available. The Mac bundle is built with Electron Forge and uses Apple's disk-image tools for the DMG. A normal desktop execution environment is required; REA process capture ran this session's GUI tests and disk-image verification.

The release is ad-hoc signed for local use, not Developer ID signed or notarized. Tested on macOS 27.0.1 arm64. The embedded runtime declares a macOS 13 minimum, but earlier OS versions and Intel were not verified. No automatic updater or App Store release is configured. Tests use isolated data roots and synthetic fixtures; native file-picker results are replaced with fixture paths in automation.

## Source layout

- src/main/imports: bounded input parsing, report previews, persistence and analytics queries.
- src/main/storage: database schemas, transactional migration and backup/restore.
- src/main/index.ts and src/preload: serialized validated IPC, native dialogs and the narrow bridge.
- src/shared/analytics.ts: report contracts and invariant validation.
- src/renderer: dashboard, table, chart, preview and desktop UI.
- tests: real SQLite/fixture tests and packaged Electron interaction checks.
- docs/SPEC-imports-dashboard.md and docs/VERIFICATION-0.2.0.md: scope and verification evidence.

Live OAuth, competitor discovery, keyword data, project planning, AI writing, thumbnails and media tools are subsequent modules. The main-process protected-credential service is available for those modules; actual Keychain/OAuth access is not exercised by this local-import release.
