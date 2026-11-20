# Creator Desk contributor and agent instructions

## Scope and safety
- Creator Desk is an Electron, React and TypeScript desktop application; always inspect this repository's own manifests, workflow and source before making claims about technologies, runtime versions or supported platforms.
- Never write to a creator's YouTube channel without per-video, per-field explicit confirmation. Preserve unapproved title, description and tags exactly, and retain the checked-field audit trail.
- Use GitHub issues and [tasks/plan.md](tasks/plan.md) for Sprint and backlog tracking. Describe intended scope, tests and acceptance in each PR. Fix build breaks in the current PR without unrelated feature changes.

## README badge policy
This repository follows [Mad Mallard Repository Standards](https://github.com/drakeg/madmallard-repository-standards), when that repository contains applicable documented rules. The repository currently has only a short landing README, so the verified local rules below apply until central templates are published.

- Keep the compact `<!-- badges:start -->` / `<!-- badges:end -->` badge block directly under the first H1 in `README.md`. Use Shields.io and official GitHub Actions badge URLs; preserve the remaining README.
- Show only technology and version information backed by `package.json`, `package-lock.json`, workflow configuration or actual source files. TypeScript, React, Electron and Vite badges **dynamically read the main branch's package.json**; never replace them with a fixed current version. CI Node runtime badges must be updated when workflow runtime versions change and are checked against the workflow.
- The workflow badge reflects the real `Desktop releases` workflow covering lint, typecheck, unit tests, audit, packaging and installed-app tests. Never replace it with a hard-coded green status.
- Use live Shields.io GitHub badges for published releases, issue counts and PR counts. Do not imply a release exists merely from a package version.
- Link badges to their source configuration, relevant GitHub Actions workflow, releases or issue/PR pages. Do not include license badges unless an actual license file is present and verified.
- Do not advertise Docker, Vercel, AWS or other deployment platforms without configuration proving support. Electron's desktop targets are not container deployment capabilities.
- Keep badges to two or three compact rows, avoid redundant claims, and ensure every badge and its destination remains accessible.
- Run `node scripts/validate-readme-badges.mjs` after changes to README, versions, CI, deployment, license or repository metadata. Documentation CI must enforce this; failing badge validation blocks merge.
- Review updates as part of each affected normal development PR rather than opening a standalone PR for every routine version bump.

## Contributing with coding agents
Agents may propose and implement focused changes, tests and documentation through ordinary pull requests. Record enhancements in the current Sprint only when in scope; otherwise create or link a backlog issue. Break/fix work can be prioritized immediately. Do not silently merge, claim green CI without verification, or publish unreviewed YouTube metadata changes.
