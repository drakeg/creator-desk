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

# Analytics integration sprints

The user requested sprint-based delivery of the remaining analytics integrations. Task status is now tracked in [GitHub roadmap #31](https://github.com/drakeg/creator-desk/issues/31); the completed historical plan above is retained. GitHub Issues are the task-list target for this work, rather than a second editable checklist in this file.

## Sprint sequence

| Sprint | Status | Outcome | Stories |
| --- | --- | --- | --- |
| 1: Reach | Active | Automatic impressions/CTR reporting with honest coverage | #32 job lifecycle, #33 ingestion/cache, #34 analytics view |
| 2: Retention | Planned | Select an owned video and inspect its dated retention curve | #35 retrieval/cache, #36 retention view |
| 3: Audience | Planned | Understand geography, demographics, devices and subscription status | #37 geography, #38 age/gender, #39 device/subscribed status |

One active scope-based iteration initially; no delivery dates are invented. At the end of each sprint/release, review completed acceptance criteria, remaining work, API constraints and regressions. Only released stories count as done. The tracker moves Planned → In progress → In review → Released, with a linked PR and release. Future planning may set calendar timeboxes once throughput is established. Creating this plan does not imply unattended background execution.

## Architecture and dependency order

1. [#32](https://github.com/drakeg/creator-desk/issues/32): Discover reach report types and reuse/create a basic reach job, with protected channel authorization, bounded pagination and clear provider errors. Validate official contracts before wiring the UI.
2. [#33](https://github.com/drakeg/creator-desk/issues/33), depends on #32: bounded report ingestion, revision replacement and channel-owned cache/backup support. Split parser and storage into independent PRs if needed.
3. [#34](https://github.com/drakeg/creator-desk/issues/34), depends on #33: dated Reach view, impression-weighted CTR, coverage and setup/pending states. Checkpoint: complete setup→pending→data→refresh→offline flow and all native installer jobs.
4. [#35](https://github.com/drakeg/creator-desk/issues/35): single-owned-video retention query/cache. Reuse the cache conventions proven above, but keep retention ratios distinct from percentages.
5. [#36](https://github.com/drakeg/creator-desk/issues/36), depends on #35: video retention selection/chart. Checkpoint: complete real desktop flow and all native jobs.
6. [#37](https://github.com/drakeg/creator-desk/issues/37): country breakdown with metric units, pagination and clear denominators.
7. [#38](https://github.com/drakeg/creator-desk/issues/38): age/gender viewer percentages with privacy states and correct normalization.
8. [#39](https://github.com/drakeg/creator-desk/issues/39): device/subscribed-status breakdowns; independent distributions stay separate. Checkpoint: complete audience workflows, cross-channel isolation, backups and all native jobs.

## Limits that affect acceptance

- Reach uses YouTube Reporting API basic reach reports, not the existing Analytics daily query. New jobs have roughly 30 days of prior historical reports; availability can take days. Retain downloaded history locally; do not promise all-time reach backfill. Historical Studio imports remain supplementary sources, with explicit overlap rules.
- Discover available report types instead of treating an unsupported type as an empty successful report. Reuse existing jobs and avoid duplicate daily datasets. Basic and combined datasets cannot be summed together.
- Backfill revisions replace matching periods. Download destinations, compressed size, decompressed size, dimensions and numeric fields require validation.
- CTR aggregation uses impressions as weights for compatible rows; never average percentages or calculate thumbnail CTR as total video views divided by impressions.
- Retention requires one video per query; watch ratios may exceed 1 due to repeat watching. Do not clamp to 100% or label every decline as a causal finding.
- Audience data may be withheld for privacy. Age/gender percentages can have separate denominators by playback segment; do not add separately normalized percentages.
- Missing, delayed, unsupported, withheld and failed requests have distinct visible states. No invented rows or zero-filled gaps.
- Cache provenance, channel/date/video scope, cancellation, backup compatibility and rollback must be tested before UI exposure. Never send tokens or arbitrary provider URLs to the renderer.

## Definition of done

Each linked issue has acceptance criteria, verification and likely files. Keep individual PRs focused (split stories spanning more than about five files). Run focused tests during each increment; final delivery requires typecheck, lint, unit tests, desktop end-to-end tests, and installed-app verification on Apple Silicon/Intel macOS, Windows and Linux. Review empty/error/offline/privacy states and compact/dark layouts. A merged PR alone is In review/delivering until the release and assets are verified. Preserve existing channel authorizations, imports, Shorts and backups.

Official sources: [Reporting API/history](https://developers.google.com/youtube/reporting/v1/reports), [reach reports](https://developers.google.com/youtube/reporting/v1/reports/channel_reports), [channel analytics/retention/audience](https://developers.google.com/youtube/analytics/channel_reports).
