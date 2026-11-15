Creator Desk 0.14.0 — First vidIQ-replacement features to test

This release packages the already-merged creator-focused Research and Optimize features. It does not yet replace all paid vidIQ capabilities.

New: Topic Research
- Open **Research** to search actual public YouTube videos by topic or keyword. Review titles, creator/channel names, publishing dates, and current cumulative view counts when available, with direct source links.
- Research requires an authorized YouTube connection. Search is deliberately user-triggered and capped at 20 searches per workspace per UTC day; each request returns up to 10 videos. No fabricated keyword volume, proprietary scores or growth predictions.
- Research results are for competitive discovery only and cannot be used as sources for Shorts.

New: Video Optimize
- Open **Optimize** and select one of the connected channel's own uploads to review its current title, description and tags.
- Receive transparent, local rule-based guidance for title clarity, missing/short descriptions and duplicate tags; review candidate phrases found in the existing title.
- Edit title, description and tag drafts, then copy the reviewed draft for manual application. This version does not publish metadata changes or automatically generate AI-backed alternatives.
- Only videos from the authenticated channel's synced upload library are eligible.

Improved: Owned-video Shorts workflow
- Open **Studio** to choose your own uploaded video by title from the connected channel, or choose a local video as before.
- Selecting a YouTube upload does not download media. To edit it, select an authorized local copy of that video. This is an interim handoff, not direct YouTube-video processing. No public or competitor videos are made available as Shorts source material.

Existing features
- Retention and Reach analytics, offline workspace data, and the YouTube changes register remain available.
- The complete Mad Mallards YouTube Watch automation/reporting sync is not yet included in this desktop release.

Upcoming — not included in v0.14.0
- Updated/unanswered comments inbox and optional reply workflow
- Advanced context-aware title, description and tag recommendations with explicit AI consent
- Competitor/outlier analytics and saved idea planning
- True direct-from-own-YouTube-video Shorts editing, subject to permitted media access

Testing and package security
- Native CI builds and installed-app checks cover macOS Apple Silicon, macOS Intel, Windows x64 and Debian/Ubuntu Linux x64. Verify all four build jobs, published artifacts and SHA-256 checksums before marking the release done.
- macOS is ad hoc signed but not notarized, and Windows builds are unsigned. A build that has not completed CI is not a verified installer.
- Test with the connected channel you own; AI models and third-party paid services are not required for the new rule-based recommendations.
