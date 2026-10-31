# Creator Desk 0.7.1 (development)

An installable desktop app for importing creator analytics and synchronizing read-only YouTube channel totals. macOS, Windows, and Debian/Ubuntu Linux builds are supported. Research and AI tools remain planned.

## Create Shorts

Open **Studio**. Select an installed FFmpeg executable, then choose an MP4, MOV, M4V, or WebM source. Trim 1–180 seconds, adjust vertical framing, and export a 720×1280 H.264/AAC MP4. Timed captions can be burned into the video and also export as a uniquely named SRT sidecar. Your original video is never modified.

AI is optional. Configure Ollama or an OpenAI-compatible model for transcript-based clip suggestions. Import SRT/VTT captions for an entirely local Ollama workflow, or separately configure a compatible speech endpoint to transcribe extracted audio. Providers receive only the data you explicitly permit, when you start the corresponding action. No AI receives general filesystem, computer-control, or publishing access. See [Shorts setup and limits](docs/SHORTS.md).

## Connect YouTube

In Settings, choose **Connect YouTube** if the build includes the publisher's Google configuration. Complete consent in your system browser, return automatically to the app, and sync. No Google Cloud project is needed for each user of a preconfigured build.

If no application is configured, the in-app setup guide provides exact clickable/copyable links to create a project, enable both APIs, configure consent/test users, and download/import a Desktop app credentials JSON. See [connection setup](docs/YOUTUBE-CONNECTION.md). Publishers can configure the application once for everyone using [publisher-managed Google sign-in](docs/GOOGLE-PUBLISHER-SETUP.md).

This stage retrieves channel views, subscriber count (which may be rounded or hidden), and video count. Last successful totals remain available offline and are separate from imported report periods. Daily analytics and upload snapshots are available from Dashboard after granting both read-only permissions. Analytics date ranges are limited to 366 days; uploads are capped at 100 with truncation disclosed. Retention remains later work.

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

The release is ad-hoc signed for local use, not Developer ID signed or notarized. Native CI verifies installed builds on macOS 15 arm64/x64, Windows x64, and Ubuntu x64. Local desktop tests also run on macOS arm64. The embedded runtime declares a macOS 13 minimum; that minimum OS version is not separately verified. No automatic updater or App Store release is configured. Tests use isolated data roots and synthetic fixtures; native file-picker results are replaced with fixture paths in automation.

## Source layout

- src/main/imports: bounded input parsing, report previews, persistence and analytics queries.
- src/main/storage: database schemas, transactional migration and backup/restore.
- src/main/index.ts and src/preload: serialized validated IPC, native dialogs and the narrow bridge.
- src/shared/analytics.ts: report contracts and invariant validation.
- src/renderer: dashboard, table, chart, preview and desktop UI.
- tests: real SQLite/fixture tests and packaged Electron interaction checks.
- docs/SPEC-imports-dashboard.md and docs/VERIFICATION-0.2.0.md: scope and verification evidence.

Retention, competitor discovery, keyword data, project planning, AI writing, thumbnails and media tools are subsequent modules. OAuth protocol and API behavior are tested with controlled fixtures; completing real Google consent requires your own Desktop app client.

## Downloads

Installers and portable builds are published on the [Releases page](https://github.com/drakeg/creator-desk/releases). Native release jobs cover Apple Silicon and Intel Macs, Windows x64, and Debian/Ubuntu Linux x64. All four jobs must pass installed-application tests before publication. See [release notes](docs/release-notes.md) for signing status.
