# Dependency maintenance

Review dependency updates individually, including the generated lockfile. Keep clean installation, lint, type checks, tests, audit, native packaging, and installed-app tests enabled.

## TypeScript compatibility

TypeScript stays at 6.0.3 because typescript-eslint 8.72.1 supports `>=4.8.4 <6.1.0`. Renovate's matching `allowedVersions` rule prevents incompatible compiler PRs. Revisit the rule when the lint tooling supports newer compilers; update the compiler and compatible tooling together and regenerate the lockfile without bypassing peer validation.

See [the supported dependency versions](https://typescript-eslint.io/users/dependency-versions/).

## Release versions

Every main-branch dependency update still builds and tests all four desktop targets. The publisher checks GitHub after those checks pass. An already published version is preserved and publication is skipped successfully; a new version creates a release, and an existing draft can resume. Authentication, rate-limit, server, and malformed-response errors fail the job instead of being treated as a missing release.

Bump package.json and package-lock.json, update the app's reported version and release notes, and merge through a checked PR when new installers are ready. Never replace published assets for the same version.

## Audit review (2026-10-30)

The current production dependency audit reports zero vulnerabilities. The full development-tool audit reports 23 moderate findings, propagated from two advisories in build/lint tooling: [glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249). These tools operate on the repository during builds and are excluded from packaged app dependencies. No high or critical findings were reported.

Keep the full audit gate at high severity and review upstream fixes as they become compatible. Do not apply npm's suggested major downgrades or force incompatible transitive major versions solely to clear the report.
