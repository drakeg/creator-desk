# Creator Desk — First SMB Pilot Plan

**Status:** discovery hypothesis, not a validated commercial offering. No paying customer, revenue, measured time saving or willingness to pay has been established by this plan.

## First customer

A solo YouTube creator, two- to five-person video agency, or SMB marketing owner who manages an **owned** YouTube channel and has at least 20 published videos. They regularly revise descriptions, respond to comments, and assemble vertical clips.

## Main pain and product promise

Current work requires switching between spreadsheets, YouTube Studio and editing utilities to decide which existing videos need a metadata review, triage comments and export Shorts. Creator Desk's hypothesis is that a local, privacy-aware workflow can **reduce manual review time** while retaining full creative control. It is a vidIQ-style optimization companion, **not** a YouTube Studio replacement or a video ranking predictor.

## Narrow pilot — no paid tools required

Run one approved, non-production-sensitive **owned channel** through a guided workflow:

1. Install a checksum-verified Creator Desk preview on a supported desktop OS; note signing limitations. Connect channel with read-only permission first.
2. Sync channel history and open Optimize. Time how long the operator takes to find one actual metadata gap using the new needs-review filter (after PR #107 is merged and tested).
3. Add one factual tag suggestion to a local draft (after PR #99 is merged). Edit any title/description changes manually; record the approximate manual comparison time.
4. Show the exact, **per-field approval** before/after preview. No actual YouTube write is required for pilot usability research. If the owner separately elects a live test, first confirm explicit owner authority and editing permission and a suitable video; record outcome without claiming production readiness.
5. Use the recent comments inbox and owned-media Shorts export in a second session. Measure task completion, unclear states and failures.
6. Ask which workflow saves the most time and whether the user would use it weekly. Collect consent before retaining customer feedback.

## Measure outcomes — keep observed and estimated separate

- Setup friction: minutes and number of failed steps until successful channel sync.
- Optimization triage: time to identify a factual review item, number of video cards opened and whether proposals were actionable.
- Approval safety: 100% of users can identify exactly which fields would change; no unapproved change submitted.
- Comments: minutes and number of threads reviewed; preserve unknown-reply states where API coverage is partial.
- Shorts: time from **authorized own media** to a correctly exported vertical clip.
- Activation: weekly return usage, completed workflows and customer-reported usefulness.
- Feedback: requests for features, perceived time savings, and stated price sensitivity. Never convert intention into actual payment or usage data.

## Price and offer hypothesis

Test a no-cost guided pilot first. Ask about willingness to pay **$15–$39/month per creator workspace** or an optional one-time setup/support fee; do not promise this pricing or assume conversion. Compare freely available alternatives such as YouTube Studio's native capabilities and creator research/optimization products. Validate whether the paid value is *time saved* and a coherent workflow, not fictional viral or keyword-volume scores.

## Commercial gate

Proceed toward paid beta only after several independent creators successfully complete the core workflow, report repeatable practical benefit, accept the safety model and demonstrate meaningful willingness to pay. Prioritize fixing blockers over AI provider integrations or extra dashboards. Document actual sample size, attrition and negative feedback.

## Privacy and boundaries

No live video changes without separately obtained owner approval, no automatic replies, no unrelated repository/tenant integration, no paid AI dependency, and no storage of customer credentials in research notes. Keep pilots independent and anonymize feedback when possible.

Related: [SPRINTS.md](../SPRINTS.md), [BACKLOG.md](../BACKLOG.md), [RELEASES.md](../RELEASES.md) and [roadmap issue #83](https://github.com/drakeg/creator-desk/issues/83).
