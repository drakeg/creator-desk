# YouTube connection

## Channel overview

The interface calls workspaces **Channels**. Each channel has independent Google authorization and local history; application credentials remain shared. After sign-in, open Channel overview for the initial automatic history sync. Later refreshes use Sync channel history. It retrieves daily views, watch time and subscriber change from creation through yesterday in nonoverlapping windows, and paginates the full upload library. Missing dates are not zeros. Video views are cumulative and separate from daily date filters. Progress, cancellation, atomic replacement and offline cache are supported. CSV tools are secondary under Saved reports & imports. This does not fetch every Studio metric or analytics dimension.

Legacy per-report sync endpoints remain for compatibility, but the desktop interface uses the unified history workflow. The old 100-upload truncation is removed; current capacity is 20,000 uploads, with an explicit failure rather than truncation.

## Connect a channel

1. Add or select the channel area using the sidebar. Existing workspace names and data are retained.
2. In Settings → YouTube connection, choose Connect YouTube. If the build has no publisher configuration, use the linked setup guide to enable YouTube Data API v3, YouTube Analytics API and (for Reach) YouTube Reporting API in your Google project, configure consent/test users and import a **Desktop app** credentials JSON.
3. Complete consent in your system browser, selecting the Google account or Brand Account for this channel and granting both read-only scopes. No Google password is entered in Creator Desk.
4. Choose Open channel overview. The first history sync starts automatically; progress and Stop sync are shown. A failed initial attempt can be retried manually without deleting existing data.
5. Use date presets or Custom dates for daily analytics. The video list shows cumulative views at sync, independently of the daily date filter. Saved reports & imports contains optional exports and previous snapshots.

Google application configuration is shared across channel areas, but every channel has its own sign-in. Replacing application credentials requires disconnecting all channels. If a build contains the publisher's Desktop OAuth configuration, no personal Google project is needed. See [publisher setup](GOOGLE-PUBLISHER-SETUP.md). Test-mode tokens may expire; reconnect if Google reports revoked or expired access.

Sync retrieves daily views, watch time and subscriber change, and all available uploads. Impressions and CTR are available separately under Dashboard → Reach after enabling YouTube Reporting API and choosing Enable reach reporting. Once configured, Sync channel history refreshes available Reach reports too. Retention, revenue, audience and traffic-source breakdowns remain planned. Unsupported metrics are not shown as zero. API processing delays and unavailable uploads can cause coverage differences from Studio. Managed history is replaced atomically, while imported and legacy report snapshots are retained separately. Backups containing managed history require Creator Desk 0.11 or later.

## Data and security

- Only `youtube.readonly` and `yt-analytics.readonly` are requested. No upload, metadata modification, or publishing endpoints are called.
- Authorization uses PKCE S256, unpredictable state, and a temporary listener on `127.0.0.1` with a random port. The listener closes after completion, cancellation, app shutdown, restore, or a five-minute timeout.
- Google authorization and API endpoints are fixed in the main process. Credential JSON cannot override endpoints. The renderer receives connection state and the channel snapshot, never tokens or the client secret.
- Application configuration and tokens are encrypted using Electron safeStorage. Linux rejects the unprotected `basic_text` backend; an unlocked system keyring is required. macOS uses Keychain and Windows uses DPAPI. Current synchronous safeStorage APIs match the existing vault and require migration before Electron 46.
- Credentials are excluded from backups. Channel snapshots are validated database settings and are included in backups. Restoring data does not grant new Google authorization.
- Disconnect removes the channel area's local tokens and channel snapshot, while preserving saved reports, including prior API reports. It does not revoke the Google grant for other channel areas. To revoke the grant, use your Google account's third-party connections controls.
- Replacing application configuration requires disconnecting all connected channels. A channel identity change is rejected until the user explicitly disconnects and reconnects.
- Remote responses are limited to 1 MB and 20 seconds per request. Errors do not return raw provider bodies or secrets to the UI.

## Verification and limits

Unit tests exercise real loopback callbacks against a controlled token transport: forged state (including Unicode), PKCE, cancellation, refresh, revocation, bounded responses, workspace isolation, late completion after cancellation, hidden metrics, channel identity changes, offline cache preservation, and backup validation. Electron tests cover credential-file rejection and persisted cached totals after restart.

A real Google account consent and API smoke test is still required with an actual Desktop client; automated tests do not claim that external verification. Retention, full-history upload synchronization, scheduled synchronization, and automatic revocation are outside this slice.

## Official references

- [Desktop OAuth and PKCE](https://developers.google.com/identity/protocols/oauth2/native-app)
- [YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list)
- [Channel statistics](https://developers.google.com/youtube/v3/docs/channels#statistics)
- [Electron protected storage](https://www.electronjs.org/docs/latest/api/safe-storage)

- [Analytics query parameters and availability](https://developers.google.com/youtube/analytics/reference/reports/query)
- [Channel reports and supported metrics](https://developers.google.com/youtube/analytics/channel_reports)
- [Upload playlist pagination](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list)

## Reach in 0.12

Reach setup uses an explicit action to schedule daily basic reach reports. New jobs normally provide roughly 30 days of prior data and then accumulate future data; initial availability may take a day or two. The view identifies actual downloaded coverage, pending/empty/error/offline states and the last successful check. Dates use Pacific time. Refresh downloads new/revised reports atomically without summing revisions. CTR uses documented provider percentage units weighted by impressions; missing denominators/values remain unavailable. CSV snapshots are kept separate.

Reporting API setup link: https://console.cloud.google.com/apis/library/youtubereporting.googleapis.com . Publishers must enable that API in their configured Google project as well.
