# Creator Desk capability map

Status: desktop-core is implemented. Version 0.2.0 adds local CSV/JSON imports and imported channel analytics. Version 0.5 adds daily Analytics reports and capped upload snapshots to desktop OAuth and manual channel totals. Retention and the remaining modules are planned.

## Product scope

Build an independently implemented, installable macOS application for video creators. Support live YouTube connections and local imports, with projects and application data stored on the Mac. No hosted application server is required; live data and remote AI providers require internet access.

The initial scope supports one local user, multiple workspaces and channels, and offline access to imported/cached data. Creator Desk uses its own name, visual design and assets. AI providers and public installer distribution are later decisions.

## Modules

Dependencies identify prerequisite modules. Module specifications describe their interfaces and acceptance criteria.

| Module id           | Responsibility                                                                                                                              | Depends on                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| desktop-core        | Mac app lifecycle, navigation, local database, settings, backup/export, app bundle and installer                                            | —                                                                             |
| data-connectors     | Validated CSV/JSON imports, YouTube desktop OAuth, API synchronization, credentials in Keychain, source and freshness tracking              | desktop-core                                                                  |
| channel-insights    | Feed, uploads, channel audit, retention, comments analysis, milestones, monetization progress, posting-time analysis where data supports it | data-connectors                                                               |
| discovery           | Keyword research, video/Shorts search, outliers, rising topics, breakout channels, thumbnail references                                     | data-connectors                                                               |
| competitor-tracking | Watchlists, public-channel snapshots, comparisons, daily/cumulative/normalized charts and alerts                                            | data-connectors                                                               |
| ai-runtime          | Local/remote model adapters, capability checks, usage and error handling, structured outputs                                                | desktop-core                                                                  |
| project-planner     | Projects, saved ideas, briefs, editorial calendar, attachments, history                                                                     | desktop-core                                                                  |
| creator-assistant   | Channel-aware AI coach, daily ideas, research synthesis, scripts, titles, descriptions and tags                                             | ai-runtime, channel-insights, discovery, competitor-tracking, project-planner |
| packaging-studio    | Thumbnail creation/editing, title-and-thumbnail variants, previews and version history                                                      | ai-runtime, project-planner                                                   |
| optimization        | Video review, metadata drafts, score explanations, packaging-change tracking, publication and experiment workflows where supported          | channel-insights, creator-assistant, packaging-studio                         |
| media-tools         | Local video import, transcription, clipping, captions, vertical reframing, export and optional generated video                              | ai-runtime, project-planner                                                   |
| integrations        | Optional browser companion, local MCP tools, Instagram workflows, resource links and coaching handoff                                       | optimization, media-tools, competitor-tracking                                |

## Proposed build order

1. desktop-core + data-connectors + channel-insights: an installable app that imports real data, persists it through restart, and can connect to YouTube when credentials are configured.
2. discovery + competitor-tracking + project-planner: research, comparisons, saved ideas and calendar.
3. ai-runtime + creator-assistant: channel-aware recommendations and writing tools.
4. packaging-studio + optimization: thumbnails, metadata editing and performance tracking.
5. media-tools + integrations: clipping, generated media, browser/MCP and Instagram additions.

Each stage should deliver working workflows. Unimplemented features must be marked clearly; no fabricated live metrics or inactive controls presented as complete.

## Data boundaries

- Live YouTube access requires a Google Cloud project and desktop OAuth credentials. Existing browser sessions are not a credential source for the application.
- Global keyword volume and opportunity scores require a separately validated provider or clearly labeled independent estimates.
- Historical competitor graphs require collected snapshots or a suitable historical data provider.
- AI recommendations and media generation require independent implementations and explicitly selected providers.
- Retention and private channel analytics depend on authorized access and supported reports. Unavailable metrics remain unavailable.
- Publishing, metadata changes and experiments require verified API support and explicit user workflows.
- Human coaching and educational content require separate service/content decisions.

## Sources

- Google desktop OAuth: https://developers.google.com/youtube/reporting/guides/authorization/installed-apps
- YouTube Analytics API: https://developers.google.com/youtube/analytics/reference
- YouTube search endpoint: https://developers.google.com/youtube/data/reference/rest/v3/search/list
- YouTube Studio exports: https://support.google.com/youtube/answer/9717005

## Current implementation

See SPEC-desktop-core.md, SPEC-imports-dashboard.md, README.md and VERIFICATION-0.2.0.md. See YOUTUBE-CONNECTION.md for desktop OAuth and manual channel-total synchronization. Daily reports and upload snapshots now feed the existing viewer. Version 0.6 prioritizes Shorts creation: local trim/reframe/export, timed captions, optional speech transcription, and clip suggestions from user-selected AI including Ollama. Next: polish Shorts and extend report/project management.
