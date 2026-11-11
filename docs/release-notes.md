Creator Desk 0.12 adds a working Reach view for impressions and thumbnail CTR.

- Open Dashboard → Reach. Enable YouTube Reporting API in the same Google project, then choose Enable reach reporting. A direct setup link opens in your system browser.
- Setup reuses an active basic reach job or schedules daily reports with existing read-only access. First reports can take a day or two; new jobs normally provide the preceding 30 days, not all-time reach history. Waiting is shown explicitly.
- View downloaded coverage, filter dates/videos, inspect daily/video tables and see impression-weighted CTR. Provider percentage units are retained; missing values and zero denominators stay unavailable.
- Refresh, cancellation, offline cached results, safe revision replacement and database backup/restore are supported. Download URLs and Google tokens never reach the view or database backups.
- After Reach setup, Sync channel history also refreshes available reach reports. CSV snapshots remain separate to prevent overlapping totals.

Reach cache/staging is limited to 4 MiB; report downloads to 8 MiB. Limit errors preserve previous data. CTR source rounding can cause small differences from Studio. Retention and audience integrations remain planned in Sprints 2 and 3. No live Google account was used in automated verification.

Downloads cover Apple Silicon/Intel macOS, Windows x64, and Debian/Ubuntu Linux x64. macOS builds are ad hoc signed and not notarized; Windows builds are unsigned. Checksums are included.
