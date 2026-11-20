# Contributing to Creator Desk

Creator Desk is a cross-platform Electron desktop app with local SQLite data and an optional YouTube connection. Follow [Mad Mallard Repository Standards](https://github.com/drakeg/madmallard-repository-standards), [AGENTS.md](AGENTS.md), [SPRINTS.md](SPRINTS.md) and [BACKLOG.md](BACKLOG.md). This application's channel-ownership, approval and data-preservation requirements take precedence over generic templates.

## Development workflow

1. Choose a small GitHub Issue from the current sprint or backlog. Record user/creator benefit, scope, dependencies and acceptance criteria. Fix urgent breakages immediately and link the follow-up.
2. Branch from current `main`. Prefer `feat:`, `fix:`, `test:`, `docs:`, `chore:`, or `release:` commits. Do not overwrite another PR's branch.
3. Use exact versions from `package.json` and `package-lock.json`; run `npm ci --ignore-scripts`, `npm run bootstrap`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm audit --audit-level=high`. Run `npm run test:e2e` with the installed native app environment and test tooling where supported; follow the workflow for per-OS dependencies.
4. Run `node scripts/validate-readme-badges.mjs` when the standard validation script is present. Update badges in the same PR when stack/workflows change.
5. Open a reviewable PR with linked issue/sprint, before/after behavior, tests run, security/data impact, risks, rollback and release classification.
6. Repair failing CI and test real installed workflows. Require four-platform desktop checks and any documentation checks to pass. Do not label pending/skipped checks as verified.
7. Merge under branch protection and required reviews, maintain release documentation, and continue to the next ready task.

## Creator data and YouTube safety

- Only videos belonging to the authenticated connected channel can enter the optimization/writeback flow.
- Recommendations and suggested tags edit **local drafts only**. Never enable YouTube editing without deliberate consent.
- Require distinct field selections, exact reviewed before/after diffs, one explicit approval per video, a fresh ownership/metadata check and verified readback. Preserve unapproved fields, tags and descriptions.
- Never bulk-update, auto-publish, silently retry uncertain writes, or run live YouTube writes in CI. Test using synthetic fixtures.
- Preserve user data and safe backups; never log Google OAuth tokens or local secrets.

## Environment and accessibility

The supported product is an installable native desktop app, not a LAN-accessible web server. The existing GitHub Actions matrix is the primary early test environment for macOS Apple Silicon, macOS Intel, Windows and Linux. Do not claim a Docker, Vercel, or LAN deployment without a separately designed, tested service and true user benefit. Test keyboard navigation, focus, sensible empty states, readable contrast, and screen-reader labels.

## Definition of done

Acceptance demonstrated; tests and checks green; no unapproved data changes; docs/badges current; released behavior distinguished from unreleased code; reviewer approval and evidence linked. Follow [RELEASES.md](RELEASES.md) for release gates.
