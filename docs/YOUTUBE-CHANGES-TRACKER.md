# Official YouTube changes tracker — Creator Desk

The **YouTube changes** tab under **Dashboard** keeps a local, channel-scoped, source-backed action register for Mad Mallards Adventures or any other workspace.

## Current capabilities

- Category: monetization eligibility, Shorts, long-form features, sponsorship/BrandConnect opportunities, affiliate disclosures, and official policy.
- Each record includes an official HTTPS source, optional publication and effective dates, description, channel-specific impact, required action, verification state, workflow state, follow-up date, and notes.
- Views: New, To verify, Actions in progress, Completed, Dismissed, All.
- Add, edit, open a verified-domain source in the default browser, or remove a record with confirmation. Dismiss an obsolete item instead of deleting it when an audit trail is useful.
- The app stores each record in the selected workspace's local SQLite database. Existing Creator Desk backup/restore includes and validates records; no cloud service or paid API is involved.
- Empty means **no saved records**, not “no YouTube changes”; no official policy changes or monetization eligibility conclusions are fabricated.

## Update from Chat

Ask ChatGPT to research an **official** YouTube/Google or regulator page and prepare **one JSON object** with these exact keys:

```json
{
  "category": "policy",
  "title": "Replace with official source title",
  "sourceUrl": "https://support.google.com/youtube/answer/72851",
  "publishedDate": null,
  "effectiveDate": null,
  "description": "Describe only confirmed source details.",
  "channelImpact": "Explain the actual relevance to Mad Mallards Adventures.",
  "requiredAction": "Verify the source and decide what needs to change.",
  "verification": "unverified",
  "status": "verify",
  "followUpDate": null,
  "notes": "Unknowns and any conditional language."
}
```

Then select **YouTube changes → Paste ChatGPT record → Review imported record → Save change**. Pasted entries are forced to **unverified** and **To verify**, regardless of generated claims. You can manually mark them verified after reviewing the official page. No Work handoff is needed to prepare the record, but Chat cannot silently modify a local desktop database.

The form rejects URLs from unapproved domains, non-HTTPS URLs, missing required fields, and invalid dates. Current accepted source domains cover YouTube, Google Help, YouTube Blog, Google policies/developer documentation, and US/UK advertising regulators. This is intentionally strict; official third-party brand sponsorship portals require a future source-verification workflow.

## Out of scope for this initial PR

- An automatically scheduled source monitor or Web Site deployment.
- Automatic monetization eligibility determinations from channel analytics.
- Direct one-click remote edits from a ChatGPT conversation to a locally installed desktop application.
- A shared hosted backend between a separate Site and Creator Desk.

Those require separate source connectors, hosting/access controls, and source-specific verification safeguards. No automatic background monitoring is claimed here.
