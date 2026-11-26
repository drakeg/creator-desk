# Creator Desk — Agile sprint roadmap

This plan is scoped to Creator Desk only. [GitHub roadmap #31](https://github.com/drakeg/creator-desk/issues/31), issue acceptance criteria, and [tasks/plan.md](tasks/plan.md) provide the historical detailed implementation record. This file is the current delivery overview; do not infer a feature shipped simply because code was merged.

## Product goal

Build a usable, privacy-aware **vidIQ alternative** for creators and small content businesses: discover opportunities, improve their own videos, review comments, and produce Shorts, while reducing routine manual work. A creator must explicitly select and confirm every YouTube metadata change before publication. Revenue and demand remain unvalidated hypotheses.

## Current Sprint — Creator workflow, security and repository standards

**Status:** Active. **Scope:** Work through reviewable PRs; no invented calendar commitments.

| Priority | Work | Evidence / outcome | Gate |
| --- | --- | --- | --- |
| P0 | Restore green native CI and maintain accurate README badges | PRs [#99](https://github.com/drakeg/creator-desk/pull/99), [#101](https://github.com/drakeg/creator-desk/pull/101), [#102](https://github.com/drakeg/creator-desk/pull/102), [#103](https://github.com/drakeg/creator-desk/pull/103), [#104](https://github.com/drakeg/creator-desk/pull/104); follow-up [#105](https://github.com/drakeg/creator-desk/issues/105) | CI / audit / documentation validator |
| P0 | One-click add suggested tags to **local draft**, not YouTube | PR [#99](https://github.com/drakeg/creator-desk/pull/99) in review | Tag remains unapproved, exact-diff approval still required; all native jobs green |
| P1 | Reversible needs-review filter on owned-video Optimize feed | [#106](https://github.com/drakeg/creator-desk/issues/106), [PR #107](https://github.com/drakeg/creator-desk/pull/107) in review | Count only actionable metadata gaps; preserve local drafts and approval state |\n| P1 | Next reviewable creator optimization slice | [Optimization story #83](https://github.com/drakeg/creator-desk/issues/83) | Ground recommendations in actual owner-provided context; do not invent volume/rankings |
| P1 | Validate opt-in YouTube editing against explicitly selected own test video | [Approval story #89](https://github.com/drakeg/creator-desk/issues/89) | No bulk updates, unapproved fields unchanged, precise audit, owner acceptance |
| P1 | Define first creator/SMB pilot and pricing hypotheses | [BACKLOG.md](BACKLOG.md) | Customer interviews/real usage evidence, not fabricated validation |

**Definition of done:** PR linked; acceptance tests, lint, typecheck, unit tests, installed-app E2E, packaging, and high-severity npm audit gate green; badge validator green where applicable; documentation updated; security and release impact noted. An incomplete macOS/Windows/Linux job is not a successful release.

## Completed implementation milestones

- **Foundation:** workspace persistence and backups, sandboxed Electron bridge and installable cross-platform desktop packaging.
- **Analytics:** channel history, reports and Reach/Retention slices with explicit data coverage limits.
- **Creator MVP through v0.15.1:** topic Research, proactive owned-video Optimize feed, recent comments inbox, locally owned media Shorts, exact per-field YouTube approval, readback and audit. See [docs/release-notes.md](docs/release-notes.md).
- **Recent merge work:** PRs #96–#98 improved metadata advice, added individual approval controls and created the v0.15.1 checkpoint. Merged code does not automatically prove publication or real-channel acceptance.

## Next Sprint — Better creator recommendations

**Goal:** Give a creator a practical, reviewable list of improvements that actually helps decide what to change, beyond character-count checks.

- Distinguish factual metadata observations from title/description proposals and missing context.
- Preserve unsubmitted local draft edits when refreshing video metadata; warn when the same field changed remotely, and invalidate previous field approvals (current feature slice).
- Save/restore individual owner-video drafts in workspace-scoped SQLite settings with explicit Save/Remove actions, bounded to eight videos per workspace; compare saved baseline against current metadata before showing edits (current feature slice).
- Add per-video proposed-field and unsaved-since-save indicators, and explicit field-by-field restore-to-current-YouTube controls (current feature slice).
- Add automatic draft autosave and per-field remote-conflict resolution beyond manual reset (remaining future slice).
- Provide per-video progress states and prioritization, with honest unknown metrics.
- Verify via fake/owned metadata fixtures and installed Electron tests. No autonomous YouTube writes.
- Validate first pilot usability before expanding API cost or adding paid inference.

## Following Sprint — Comments and Shorts time savings

- Improve unanswered/new comments triage without mislabeling incomplete YouTube reply data.
- Explore creator-approved response drafts only; no unreviewed posting.
- Shorten the path from a creator's **own** uploaded video/local media to usable Shorts while respecting YouTube media access constraints.
- Test offline/failure handling, privacy, cancellation and cross-platform packaging.

## Release cadence

Use [RELEASES.md](RELEASES.md) and [docs/VERSIONING.md](docs/VERSIONING.md) for semantic versioning, installed-app gates and evidence. Continue to the next ready backlog item after a completed sprint or merge; do not interpret pending CI as a green release.
