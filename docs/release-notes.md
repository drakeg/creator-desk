Creator Desk 0.15.1 — Selective approval and improved optimization drafts

Patch release for individually approved YouTube metadata updates:
- The Optimize editor now has separate title, description and tags approval checkboxes, all unchecked by default. Edit drafts freely and select only the fields to update.
- Review selected changes presents the exact before/after values for checked fields only. Changing a draft or checkbox clears the previous confirmation. No automatic posting occurs.
- The main process independently rejects any update request that modifies an unchecked field. The authorized YouTube snippet update preserves unselected title, description and tags and still verifies current ownership, freshness and readback.
- The local audit record includes the individually approved field names.
- Optimize now offers factual title/description-alignment and chapter-start checks. Empty descriptions can use an editable title-grounded starter; v0.15.1 fixes starter paragraph breaks. The placeholder cannot be submitted unchanged.
- Google editing permission remains optional, broad, and separate from read-only recommendations. See docs/YOUTUBE-EDITING.md. Don't apply edits to a real video without checking the exact diff first.
- Electron cross-platform CI must pass on macOS ARM64/Intel, Windows x64, and Linux x64 before release publication; installers/checksums must be verified independently. No new dependencies or paid services.

---
Previous release notes

Creator Desk 0.15.0 — Comments and proactive YouTube optimization

New: Automatic vidIQ-style Optimize feed
- For a connected channel, Creator Desk opens Optimize on launch instead of making you choose a video or request an analysis.
- The latest eight synced uploads receive individually loaded, factual rule-based quality suggestions. Each card puts the channel's video thumbnail on the left and the recommendations on the right.
- Advice currently covers title clarity, empty/short descriptions, repeated tags and candidate phrases from the title. It does not claim search-volume scores, guaranteed ranking improvements or AI-generated alternatives.
- Per-video editable drafts, review and refresh are available. Thumbnails may be unavailable if the YouTube image service cannot be reached.

New: Explicitly approved YouTube metadata updates (advanced testing)
- You may separately enable Google YouTube editing permission and apply exact reviewed title, description and tag changes to a video belonging to the connected channel.
- Every update is preceded by an exact before/after confirmation and a fresh ownership/metadata check. The app sends a single update, reads the result back and records verified changes in a local audit trail.
- Google grants the broad `youtube.force-ssl` permission, which can also authorize video/comment deletion. Creator Desk uses this privilege for individually approved metadata changes; it is not an edit-only Google scope. Declining permission leaves read-only analysis available.
- The app does not auto-publish recommendations, perform bulk edits, retry uncertain updates, or change privacy settings. Treat the first live-channel edit as an explicitly authorized acceptance test on a suitable owned video, not a proven production deployment.
- See docs/YOUTUBE-EDITING.md before enabling editing.

New: Recent comments inbox
- Read the connected channel's latest comment threads with manual refresh and new/updated, needs-response, replied and unknown-replies filters.
- Mark a comment reviewed locally. A conservative unknown status is displayed when YouTube did not return enough replies to establish whether the channel responded.
- The snapshot is bounded at two pages (up to 100 threads). This release does not post replies or guarantee coverage of older threads.

Updated runtime/dependencies
- Electron 45.3.3 and typescript-eslint 8.73.0 updates are merged.
- Existing Research, Shorts local-media workflow, Analytics, Reach, Retention and offline workspace tools remain present.

Still planned
- Richer recommendations grounded in actual video contents and audience needs rather than simple metadata checks.
- Full comment pagination, reply authoring/review, richer saved drafts and competitor/outlier research.
- Direct own-upload media editing without needing to select an authorized local copy.

Test and distribution
- Four-platform CI covers macOS ARM64, macOS Intel, Windows x64 and Debian/Ubuntu Linux x64. Verify installed-app checks, checksums and release assets before calling v0.15.0 published.
- macOS remains unnotarized (ad hoc signed); Windows remains unsigned.
- The new write-back functionality was exercised with synthetic Google API fixtures in CI and needs explicit real-owner acceptance before reliance on a live channel. Keep backups before first-time testing.
- Feature PR builds are available as short-lived artifacts so future patch/minor releases need not wait for a full sprint.
