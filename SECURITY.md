# Creator Desk security policy

Report suspected vulnerabilities privately through the repository's GitHub private vulnerability reporting feature if enabled, or contact maintainers privately before sharing exploitation details. Never post tokens, credentials, personally identifying creator data or working exploits in public issues or PR logs.

## Safety requirements

- YouTube edits must be initiated only by an authenticated owner with a separate, deliberate Google editing authorization and exact per-field final confirmation. Google `youtube.force-ssl` is broadly privileged; the application must restrict its own use to approved metadata operations.
- Maintain channel/workspace boundaries, read-back confirmation and append-only audit evidence. Treat uncertain writes as unresolved until directly verified, never auto-retry them.
- Keep stored credentials encrypted, use least-privilege process isolation and avoid giving external AI providers filesystem/channel/publishing privileges.
- Keep `npm audit --audit-level=high` enabled in CI, verify upstream advisories and apply supported patches. Track unremediated risks with justification and follow-up rather than silently suppressing the gate.
- GitHub Actions validation is read-only unless publishing requires narrowly scoped temporary token permissions. Avoid untrusted fork code running with write credentials.

## Supported releases

Before the 1.0 stability milestone, the current default branch and latest verified published installer are the only actively tracked compatibility targets. Check [RELEASES.md](RELEASES.md) for installer limitations and actual release verification.
