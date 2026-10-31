# YouTube connection

This stage connects one YouTube channel per workspace and synchronizes a timestamped channel-total snapshot. Manual sync retrieves channel views, subscriber count, and video count from YouTube Data API v3. Subscriber counts can be rounded or hidden. Missing values remain unavailable. The snapshot is displayed separately from imported reports and remains readable offline. Failed requests preserve the previous snapshot.

## Connect with a preconfigured app

When the publisher includes a Desktop OAuth client, Settings shows Connect YouTube immediately. Approve both read-only permissions in your system browser; the app receives the callback automatically. End users do not need a Google Cloud project or JSON credentials. Publisher setup is documented in [GOOGLE-PUBLISHER-SETUP.md](GOOGLE-PUBLISHER-SETUP.md).

## Set up your own Google project (advanced)

1. Create or select a Google Cloud project and enable YouTube Data API v3 and YouTube Analytics API.
2. Configure the Google Auth Platform consent screen. If the app is in testing, add the account you will use as a test user.
3. Create an OAuth client with application type **Desktop app**. Download its JSON credentials.
4. Create/select a Creator Desk workspace. In Settings → YouTube connection, import the credentials JSON. Web application credentials are rejected.
5. Choose Connect YouTube. Complete consent in the system browser, selecting the Google account or Brand Account for the channel. Return to the app and choose Sync channel.

A build may use publisher-provided Desktop application configuration or an imported custom client. No real configuration is checked into source. Imported custom clients override the app default; user tokens are always protected separately. Google testing/verification requirements and quotas apply. A test-mode refresh token may expire; reconnect when Google reports revoked or expired access.

## Daily analytics and uploads (0.5)

In Dashboard, select Report from / Report to and choose Sync daily analytics. Date ranges are inclusive and limited to 366 days. Views, estimated watch hours (converted from minutes), and net subscriber change are saved as a daily report. Missing dates remain absent; no synthetic zero rows are added. Recent metrics can be delayed. The saved report period reflects the first and last returned dates; report notes also preserve the requested range. YouTube's reporting time zone applies.

Choose Sync uploads to fetch up to two upload-playlist pages (at most 100 uploads), then the matching video metadata and cumulative view counts. Videos that are unavailable or lack counts are omitted with a report note. Extra pages trigger a truncation note. These are cumulative views at sync, not views in the selected date range. Watch time, impressions, and subscriber change are unavailable for upload snapshots.

Both workflows create validated, workspace-owned reports in the existing report library. Source, channel ID, and saved timestamp are shown. Identical results with identical scope/notes reuse an existing snapshot; overlapping reports are never added together. Failed or empty responses do not create partial reports. Reports survive restart and backup/restore; existing report count and storage limits apply. Backups containing API reports require Creator Desk 0.5 or later. Older import backups are accepted.

Connections created in 0.4 must disconnect and reconnect to grant the additional Analytics scope. Old tokens retain their original scope; refreshing them does not silently grant Analytics access. Both requested permissions are required for new connections. Enable both APIs in the Google project. Detailed impressions and retention are not fetched by this stage.

The desktop synchronization test uses isolated synthetic credentials and a controlled main-process transport; it exercises the actual renderer → IPC → service → SQLite → viewer path without using a real Google account or system keyring. Real Google consent remains a separate configuration-dependent smoke test.

## Data and security

- Only `youtube.readonly` and `yt-analytics.readonly` are requested. No upload, metadata modification, or publishing endpoints are called.
- Authorization uses PKCE S256, unpredictable state, and a temporary listener on `127.0.0.1` with a random port. The listener closes after completion, cancellation, app shutdown, restore, or a five-minute timeout.
- Google authorization and API endpoints are fixed in the main process. Credential JSON cannot override endpoints. The renderer receives connection state and the channel snapshot, never tokens or the client secret.
- Application configuration and tokens are encrypted using Electron safeStorage. Linux rejects the unprotected `basic_text` backend; an unlocked system keyring is required. macOS uses Keychain and Windows uses DPAPI. Current synchronous safeStorage APIs match the existing vault and require migration before Electron 46.
- Credentials are excluded from backups. Channel snapshots are validated database settings and are included in backups. Restoring data does not grant new Google authorization.
- Disconnect removes the workspace's local tokens and channel snapshot, while preserving saved reports, including prior API reports. It does not revoke the Google grant for other workspaces. To revoke the grant, use your Google account's third-party connections controls.
- Replacing application configuration requires disconnecting all connected workspaces. A channel identity change is rejected until the user explicitly disconnects and reconnects.
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
