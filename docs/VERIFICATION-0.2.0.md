# Creator Desk 0.2.0 verification

October 29, 2026; macOS 27.0.1 arm64. Local, ad-hoc-signed preview, not notarized.

## Working scope

Video and daily CSV/JSON previews/imports; period/source labels; imported-row views, watch hours, subscriber change and impressions; searchable/sortable/paginated library; daily chart and metric-date filters; duplicate detection; workspace isolation; restart persistence; imported-data backup/restore; compatible upgrade and restore of schema-1 data.

## Validation

- 36 unit/integration tests pass using real SQLite and filesystem fixtures. Coverage includes quoting/BOM/CRLF/multiline titles, missing and signed metrics, malformed data, totals/truncation notes, deduplication across reordered input, report pagination, workspace isolation, date filtering, restart persistence, imported-data backup/restore, migration rollback and restoration of schema-1 backups, plus the previous desktop-core cases.
- 5 Electron end-to-end tests pass against the app copied out of the 0.2.0 DMG. The import scenario previews video and daily CSV fixtures, searches, verifies deduplication, filters dates, exercises a crossed date range and reset, restarts, checks workspace isolation, and exports/restores the analytics through the UI.
- The date-range regression test failed before the endpoint correction and passed afterward.
- TypeScript, ESLint and production build pass. Five packaged runtime files match the final build byte-for-byte.
- The unchanged dependency graph reports zero known advisories using the cached/offline npm audit. No new dependencies were added; this is not a freshly downloaded advisory database.
- The cached Electron archive was checked against Electron's published checksum bundled in its npm package before use.
- DMG creation, mount, app/Applications-shortcut presence, copied-app signature and matching app content verified. The image was ejected after verification.
- Both ZIP archives are checked for integrity; artifact SHA-256 checksums accompany the release.

## REA evidence

- Image build and copy verification: ev_47727ebc052aed6bf040b41d9e50710b49fb607092180bbede3d2806a93c1921.
- Packaged Electron tests: ev_aa74319642c5ec1d38a44f7d56c2937f8e93ddf4a1fee7bd16479d5dd0f84e70.
- Verified app.asar SHA-256: 054854ea59edfb270573d01f9f3fec7746155378aa54330a2bba963846d803ec.

The retained process evidence verifies root-process cleanup, not complete process/network tracing. Some unrelated/platform processes are outside sampling coverage. Test dialog selections use fixture paths; native picker interaction is not automated. Screenshot figures are fictional fixture data, not the user's channel analytics.

## Remaining limits

Manual imports use supported English field names and number formats. Locale/shape variants are rejected or disclosed; this has not been tested against a fresh export from the user's actual channel. File/row/storage and backup limits are documented in README. There is no report deletion or metadata editing yet. Views in different snapshots are never added together. Aggregate video reports cannot support arbitrary metric-date slicing; daily reports can.

No live YouTube/Google OAuth, live Keychain authorization, competitor/keyword data provider, AI/media tools, Intel/Windows or older macOS verification in this release. Existing 0.1 workspaces are preserved by schema migration; a pre-migration recovery backup is saved first. No user installation directory or real application database was modified during tests.
