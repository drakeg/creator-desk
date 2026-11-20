# Creator Desk release policy

This policy complements [docs/VERSIONING.md](docs/VERSIONING.md) and [docs/release-notes.md](docs/release-notes.md). The release process is for native desktop packages, not a web/Docker deployment.

## Semantic versions

- **Patch (0.15.1 → 0.15.2):** backwards-compatible bug, security, test, accessibility or usability fix. No API or data format break.
- **Minor (0.15.1 → 0.16.0):** usable backwards-compatible workflow or feature such as stored optimization drafts or improved comment triage. During 0.x releases, communicate compatibility expectations explicitly.
- **Major (0.x → 1.0.0):** deliberate stable contract; after 1.0, breaking API/data changes require a new major with migration and rollback guidance.

A PR merge is not proof of an installer release. Never advertise a version as publicly distributed until the matching tag, assets and checksum manifest are verified. A release is justified by meaningful user-visible improvements, operational fixes or security needs—not an arbitrary sprint boundary.

## Required release checklist

1. Link the Sprint, issues, PRs, release scope and customer impact. Update README (including truthful badges), docs/release-notes.md, SPRINTS.md and BACKLOG.md appropriately.
2. Ensure package.json, package-lock.json and displayed application version agree.
3. Verify lint, TypeScript checks, unit tests, high-severity npm audit gate, installed-app E2E, native packaging and release verification on macOS ARM64, macOS Intel, Windows x64 and Linux x64 using `.github/workflows/releases.yml`.
4. Verify actual release artifacts and SHA-256 manifests. Never assume a successful commit workflow means the publish step ran; its `publish` job may be skipped for PRs.
5. Check security/permissions, user data migration/backups, rollback steps, installer signing limitations (macOS is not notarized and Windows builds are unsigned unless independently verified), and optional Google editing consent.
6. Publish a tag/release only under existing policy and authorized repository workflows. Confirm artifacts are visible and checksums match before calling the release complete.
7. Document incomplete pilots and unverified capabilities; no claim of production-ready YouTube edits without explicit owner acceptance.

## Rapid test checkpoints

Every PR may produce short-lived native preview artifacts for early testing. The workflow documents expiry; preview is not release. For urgent fixes, patch and retest quickly, but never bypass review/security/ownership gates. Following merge, continue the next ready task rather than stopping development.

## Rollback

Preserve backups and native installers for the last verified version as authorized. Revert the affected change through a reviewed PR and rebuild; avoid database destructive downgrades without a tested migration. If a YouTube API write is uncertain, stop retries and inspect the actual video state.
