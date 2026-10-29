# Imports and channel dashboard — 0.2.0

User authorized implementation on October 29, 2026. Continue directly through coding and verification; no additional planning approval is needed.

Accept English YouTube Studio Advanced Mode video-table and daily CSV exports, and JSON arrays with equivalent fields. Use native file selection, bounded parsing, record-level validation and a preview/commit flow. A malformed file never partially saves. Preview binds to its workspace, expires after 15 minutes and can be cancelled. Require the report period or an explicit unknown/lifetime selection for video totals; infer daily periods from dates. Deduplicate identical data within the same workspace and report metadata. Reports are snapshots, not additive updates; never sum overlapping snapshots.

Dashboard: report selector, provenance/period/import date, metric summaries, daily views chart where daily data exists, sortable/searchable/paginated video library or daily table. Date filters apply only to daily metrics. Video publication dates must not masquerade as metric dates. Missing metrics remain unavailable, not zero. All metrics are explicitly totals of the imported rows; identify discarded Total rows, unavailable columns and potential truncation. No external requests, fabricated metrics or proprietary scores.

Schema 2 adds workspace-owned reports with validated normalized row data. Before upgrading schema 1, create a verifiable compatible recovery backup and migrate transactionally. Accept old schema-1 backups; restoration upgrades after saving the current state. Reject unknown/future schemas. Include reports in new backups without changing the backup container format.

Verify CSV quoting/BOM/CRLF/delimiters/Unicode, totals, missing/signed metrics, malformed numbers, duplicate identifiers, workspace isolation, report deduplication, persistence, sorting/search/date filtering, migration rollback and backup round trips. Verify the real packaged Electron UI and deliver versioned arm64 DMG/ZIP/source packages. Live OAuth is a later step requiring Google app credentials.

Limits: 8 MB input, 20,000 rows per import, 16 MB total stored normalized report payloads in this preview. Cap parsing/output at the boundary. English decimal notation; unsupported/localized column names produce a clear error. Unknown headers are ignored and disclosed. No arbitrary paths or privileged bridge escape hatches.

Official export workflow: https://support.google.com/youtube/answer/9717005
