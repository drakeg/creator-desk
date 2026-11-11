# Creator Desk 0.11.0 (development)

An installable desktop app for synchronizing YouTube channel history, importing supplemental analytics, and creating Shorts. macOS, Windows, and Debian/Ubuntu Linux builds are supported. Research tools remain planned.

## Create Shorts

Open **Studio** and choose **Set up FFmpeg** for a verified download managed by the app, or select an existing FFmpeg executable. Then choose an MP4, MOV, M4V, or WebM source. Trim 1–180 seconds, adjust vertical framing, and export a 720×1280 H.264/AAC MP4. Timed captions can be burned into the video and also export as a uniquely named SRT sidecar. Your original video is never modified.

Open **Review timed transcript** to search captions, play a moment, set clip boundaries, or correct text and timing. Save a caption correction locally before exporting; old AI suggestions are cleared when the transcript changes.

AI is optional. Configure Ollama or an OpenAI-compatible model for transcript-based clip suggestions. Import SRT/VTT captions for an entirely local Ollama workflow, or separately configure a compatible speech endpoint to transcribe extracted audio. Providers receive only the data you explicitly permit, when you start the corresponding action. No AI receives general filesystem, computer-control, or publishing access. See [Shorts setup and limits](docs/SHORTS.md).

## Connect YouTube

In Settings, choose **Connect YouTube** if the build includes the publisher's Google configuration. Complete consent in your system browser, return automatically to the app, and sync. No Google Cloud project is needed for each user of a preconfigured build.

If no application is configured, the in-app setup guide provides exact clickable/copyable links to create a project, enable both APIs, configure consent/test users, and download/import a Desktop app credentials JSON. See [connection setup](docs/YOUTUBE-CONNECTION.md). Publishers can configure the application once for everyone using [publisher-managed Google sign-in](docs/GOOGLE-PUBLISHER-SETUP.md).

Use **Add channel** for each YouTube channel you manage. Each channel area has its own Google sign-in, cached analytics, Shorts drafts and AI permissions. Google Desktop app configuration is shared; account authorization is separate. Existing workspaces retain their names and data.

After connecting, choose **Open channel overview**. The first visit automatically syncs daily views, watch time and subscriber changes from channel creation (or 2005 if creation is unavailable) through the last completed UTC day, plus every available upload. Later refreshes use **Sync channel history**. Progress and Stop sync are available. The overview defaults to all history; date presets/custom dates filter daily analytics locally. Video views are cumulative at sync and independent of those filters. CSV is not required for those core metrics.

History requests use windows of at most 366 days; empty windows are accepted, and missing days are never filled with zero. Upload pagination has no 100-video truncation. Capacity remains 20,000 uploads, 200 saved reports and 16 MB of report payloads; oversized syncs fail explicitly and preserve previous history. Refresh replaces managed cache records atomically instead of accumulating snapshots. Cached history is included in database backups. Impressions, CTR, retention, revenue, audience and traffic-source breakdowns are not yet fetched by this sync.

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

In YouTube Studio, go to Analytics → Advanced mode, choose the reporting period, then Export current view → CSV. Unzip the export and select a video table or a daily channel report inside Creator Desk's Dashboard → Saved reports & imports → Import report.

For video tables, enter the period used in Studio or explicitly select unknown/lifetime. A publication date is not the date on which views occurred. Video-table exports provide period totals, so arbitrary metric date filtering is offered only for daily reports.

Thumbnail impressions are supported under both **Impressions** and **Thumbnail impressions**. Re-import older reports to populate values previously ignored. Duration and thumbnail click-through rate are now imported and shown per record. Duration accepts seconds or MM:SS/HH:MM:SS; CTR uses percentages from 0 to 100. Percentages are not averaged into channel totals. Re-import old snapshots to add fields previously ignored.

Supported English fields: Content (or Video ID/id), Video title/title, Video publish time/published, Date, Views, Watch time (hours)/watchHours, Subscribers, Impressions, Duration/durationSeconds, Thumbnail click-through rate (%)/ctr. Views and the report identity columns are required. English decimals are supported, including quoted thousands separators. ISO dates and English dates such as Oct 10, 2026 are accepted. CSV quoting, multiline titles, BOM, CRLF, comma/tab/semicolon delimiters, and UTF-8/UTF-16 input are handled. Unsupported columns are disclosed and ignored.

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

Preview limits: 8 MB input; 20,000 data records and 100 columns per file; 200 saved reports / 16 MB of normalized report payloads across the local database. Backup format 1 holds the SQLite snapshot/settings, up to 24 MB database / 32 MB file, excluding credential files and media attachments. Dashboard → Manage reports lets you rename a snapshot, move it to Deleted reports, restore it, or separately confirm permanent removal. Renaming preserves channel provenance. Deleted reports remain in backups and count toward storage limits until permanently removed; re-importing an identical deleted report restores it. Preview tokens expire after 15 minutes and are bound to their workspace.

Migration from schema 1 saves a before-schema-2 recovery backup and updates transactionally. A failed migration preserves the prior schema. A newer schema is never silently downgraded. Imported reports are validated as part of backup inspection and included in backup/restore. Recovery backups are retained in the data directory's backups folder until removed manually.

## Build and test

Node 22.23.4+ and npm 12.2.1 were used. Exact dependency versions are pinned in the lockfile.

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

## Development sprints

Follow the [analytics sprint dashboard](https://github.com/drakeg/creator-desk/issues/31) for current work and the [implementation plan](tasks/plan.md) for acceptance rules and API constraints. Sprint 1 covers impressions/CTR, Sprint 2 retention, and Sprint 3 audience breakdowns. Unreleased work remains labelled as planned or in progress; PRs and releases are linked from their issues.
