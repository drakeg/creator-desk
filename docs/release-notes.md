Creator Desk 0.13.0 — Sprint 2: Audience retention and creator change tracking

Audience retention (Sprint 2 stories #35 and #36)
- View retention for a selected owned YouTube upload from Dashboard → Retention or the video list, with date-range filters and 28-/90-day shortcuts.
- Refresh video-specific audience watch-ratio and relative-retention curves from the YouTube Analytics API using read-only credentials; the app validates ownership and preserves previous saved data if a refresh fails.
- See video-progress percentages and elapsed timestamps when the video's duration is available. Replays can exceed a 100% watch ratio. Relative retention is not the percentage of viewers remaining.
- Save curves by channel, video, and date range for offline access. Missing or privacy-limited data is not treated as zero. Cache-age warnings explain that a snapshot may not include later activity.
- Improved chart labels, dark/light themes, compact-window layout, keyboard access, error handling and cancellation.

Additional Creator Desk GUI capability
- Dashboard → YouTube changes provides a channel-specific local register for official policy changes, monetization requirements, Shorts/long-form features, sponsorships and disclosures.
- Track source, publication/effective dates when known, channel impact, required action, verification, follow-up dates, notes, and workflow status; review summary counts for tracked changes and due items.
- Add or edit entries manually or paste a ChatGPT-prepared record for verification. Official HTTPS source domains are restricted; no rumor-based or automatically inferred eligibility data is inserted.
- This desktop version does not automatically ingest the connected Mad Mallards YouTube Watch records, perform scheduled web monitoring, or offer native remote Chat synchronization. Those remain in the backlog for independent development.

Availability and limitations
- Live retention data requires authorized YouTube channel access and API support. Some video/date combinations may not return retention curves; no missing values are invented.
- Changes are cached locally per Creator Desk workspace and included in normal database backups.
- App packages are produced for macOS Apple Silicon and Intel, Windows x64, and Debian/Ubuntu Linux x64. macOS builds are ad hoc signed but not notarized; Windows builds are unsigned. SHA-256 checksums accompany release assets.
- This release requires a successful four-platform CI run, installed-app tests, and verified release assets before it may be called released. No real Google account is used by synthetic automated tests.
