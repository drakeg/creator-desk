# Creator Desk — Prioritized product and engineering backlog

This is a short, human-readable prioritization view. [GitHub Issues](https://github.com/drakeg/creator-desk/issues) contain individual acceptance criteria and are the authoritative work queue. [SPRINTS.md](SPRINTS.md) assigns active work. Avoid duplicating historical [tasks/todo.md](tasks/todo.md).

| Priority | Outcome / problem | State and link | Customer value / acceptance |
| --- | --- | --- | --- |
| P0 | Trustworthy CI and dependency risk | [#105](https://github.com/drakeg/creator-desk/issues/105), current security follow-up | High-severity audit gate active; fix supported vulnerabilities, no silent waiver |
| P0 | Verified README and central standards adoption | [PR #104](https://github.com/drakeg/creator-desk/pull/104), in review | Live badges and code-backed versions; docs/validation/agent rules |
| P0 | Apply **only** owner-selected YouTube metadata changes | [#89](https://github.com/drakeg/creator-desk/issues/89), merged implementation, acceptance still open | Per-field selection, fresh remote check, audit, no speculative writes |
| P0 | Add title-derived candidate tags into drafts without approval | [PR #99](https://github.com/drakeg/creator-desk/pull/99), in review | Individual add action; never implicitly check approval or publish |
| P1 | More valuable owner-video recommendations | [#83](https://github.com/drakeg/creator-desk/issues/83), in progress | Video-specific evidence, helpful editable proposals and clear uncertainty |
| P1 | Local persistent optimization drafts | Next feature slice, issue to be filed when scoped | Restore edited work across restart with clear refresh/conflict behavior |
| P1 | New/unanswered comments and reply triage | Roadmap [#31](https://github.com/drakeg/creator-desk/issues/31), further slice | Accurate reply states, creator time saved, no unauthorized posting |
| P1 | Easier owner-video Shorts workflow | Roadmap, further slice | Only own media, fewer manual steps, permitted access and export reliability |
| P1 | Product-market fit and first SMB pilot | Discovery hypothesis | Recruit 3–5 creator/business pilots; record actual friction, weekly time savings and willingness to pay |
| P2 | Optional consent-based AI alternatives | Future, opt-in | Explicit provider permission/cost disclosure; creator approves every edit |
| P2 | Competitor/outlier research and idea planning | Future | Accurate public context, no unsupported scores or guarantees |
| P2 | Shared standards release/tooling updates | [Central standards](https://github.com/drakeg/madmallard-repository-standards) | Adopt tagged, verified tooling without coupling this repository |

## Commercialization hypothesis — not validated

**Buyer:** solo creators, small video agencies and SMB owners running their own YouTube channels. **Pain:** repetitive review and optimization across existing videos, response triage and Shorts preparation. **Promise to test:** save enough creator time to justify a modest monthly subscription or setup-plus-service offer. **Pricing experiment:** ask pilot customers about a $15–$39/month tool and optional assisted setup; this is a hypothesis, not current pricing or revenue. Prioritize demonstrable time saved and explicit consent over speculative growth metrics.

## Triage rules

1. Failed builds, security regressions and data/permission safety are P0.
2. Next, prioritize one usable customer workflow with a measurable acceptance test.
3. Backlog items become current Sprint work only when independently testable and appropriately scoped.
4. Preserve project independence, data, and current PR review gates. No unrequested paid service or production write.
