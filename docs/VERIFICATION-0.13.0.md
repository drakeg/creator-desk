# Sprint 2 release verification — v0.13.0

Stories: [#35](https://github.com/drakeg/creator-desk/issues/35) and [#36](https://github.com/drakeg/creator-desk/issues/36). Roadmap: [#31](https://github.com/drakeg/creator-desk/issues/31).

## Release gates (must be verified after merge)

- [ ] Source revision on `main` includes the version bump and matching npm lockfile.
- [ ] All four native `Desktop releases` build jobs pass on **main**: macOS arm64, macOS x64, Windows x64 and Linux x64.
- [ ] Each job completes lint, TypeScript checking, unit tests, dependency audit, packaging, installed-app Electron tests and artifact checksum verification.
- [ ] GitHub publishes tag `v0.13.0` with exactly seven installer/archive assets plus aggregate checksum manifest (per `.github/workflows/releases.yml`).
- [ ] Verify checksum manifest against all published download assets.
- [ ] Verify macOS ad hoc signature and installer startup, Windows install/startup, and Debian/Ubuntu install/startup from the installed-app CI logs; distinguish automated from manual review.
- [ ] Verify retention: one owned video, selected date range, timestamp labels if duration exists, replay peaks above 100%, empty report, failed refresh, cancel, offline reopen, channel switching.
- [ ] Verify accessible video controls, compact width, light/dark themes, cached freshness message and no cross-channel data leakage.
- [ ] Confirm source privacy: no OAuth token in local reports/backups; analytics gaps remain unknown and never zero-filled.
- [ ] Update issue #35 and issue #36 to Released, then close Sprint 2 and explicitly start Sprint 3 through roadmap #31. **Do not close based solely on merged PRs.**

## Scope

Sprint 2 releases the already-merged retention work plus merged YouTube changes GUI work. The connected Mad Mallards Watch automation does **not** automatically sync into the Creator Desk desktop database yet; complete GUI parity remains in the product backlog.

No paid services or third-party source code are needed. Synthetic fixtures verify the API flow; a real owner account validation is a separately tracked acceptance task if credentials are unavailable in CI.

## Verification record

Release tag: pending.

Main workflow URL: pending.

Four platform conclusions: pending.

Release checksum verification: pending.

Acceptance reviewer: pending.

Sprint status: **In review; not released**.
