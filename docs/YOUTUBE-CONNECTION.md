# YouTube connection

This stage connects one YouTube channel per workspace and synchronizes a timestamped channel-total snapshot. Manual sync retrieves channel views, subscriber count, and video count from YouTube Data API v3. Subscriber counts can be rounded or hidden. Missing values remain unavailable. The snapshot is displayed separately from imported reports and remains readable offline. Failed requests preserve the previous snapshot.

## Set up your Google project

1. Create or select a Google Cloud project and enable YouTube Data API v3.
2. Configure the Google Auth Platform consent screen. If the app is in testing, add the account you will use as a test user.
3. Create an OAuth client with application type **Desktop app**. Download its JSON credentials.
4. Create/select a Creator Desk workspace. In Settings → YouTube connection, import the credentials JSON. Web application credentials are rejected.
5. Choose Connect YouTube. Complete consent in the system browser, selecting the Google account or Brand Account for the channel. Return to the app and choose Sync channel.

The user supplies their own Google application configuration. No application credentials are bundled in source or installers. Google testing/verification requirements and quotas apply. A test-mode refresh token may expire; reconnect when Google reports revoked or expired access.

## Data and security

- Only `youtube.readonly` is requested. No upload, metadata modification, or publishing endpoints are called.
- Authorization uses PKCE S256, unpredictable state, and a temporary listener on `127.0.0.1` with a random port. The listener closes after completion, cancellation, app shutdown, restore, or a five-minute timeout.
- Google authorization and API endpoints are fixed in the main process. Credential JSON cannot override endpoints. The renderer receives connection state and the channel snapshot, never tokens or the client secret.
- Application configuration and tokens are encrypted using Electron safeStorage. Linux rejects the unprotected `basic_text` backend; an unlocked system keyring is required. macOS uses Keychain and Windows uses DPAPI. Current synchronous safeStorage APIs match the existing vault and require migration before Electron 46.
- Credentials are excluded from backups. Channel snapshots are validated database settings and are included in backups. Restoring data does not grant new Google authorization.
- Disconnect removes the workspace's local tokens and channel snapshot, while preserving imported reports. It does not revoke the Google grant for other workspaces. To revoke the grant, use your Google account's third-party connections controls.
- Replacing application configuration requires disconnecting all connected workspaces. A channel identity change is rejected until the user explicitly disconnects and reconnects.
- Remote responses are limited to 1 MB and 20 seconds per request. Errors do not return raw provider bodies or secrets to the UI.

## Verification and limits

Unit tests exercise real loopback callbacks against a controlled token transport: forged state (including Unicode), PKCE, cancellation, refresh, revocation, bounded responses, workspace isolation, late completion after cancellation, hidden metrics, channel identity changes, offline cache preservation, and backup validation. Electron tests cover credential-file rejection and persisted cached totals after restart.

A real Google account consent and API smoke test is still required with an actual Desktop client; automated tests do not claim that external verification. Detailed daily analytics, watch hours, retention, recent uploads, scheduled synchronization, and automatic revocation are outside this slice.

## Official references

- [Desktop OAuth and PKCE](https://developers.google.com/identity/protocols/oauth2/native-app)
- [YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list)
- [Channel statistics](https://developers.google.com/youtube/v3/docs/channels#statistics)
- [Electron protected storage](https://www.electronjs.org/docs/latest/api/safe-storage)
