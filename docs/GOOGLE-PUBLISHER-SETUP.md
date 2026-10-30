# Publisher-managed Google sign-in

For a distributed Creator Desk app, configure one Google project for the application. End users should then use **Connect YouTube → approve in their system browser → return automatically to Creator Desk**. They do not need Google Cloud accounts, their own projects, or a credentials JSON download.

The desktop OAuth flow uses PKCE and a temporary loopback callback. It does not require a hosted application backend. Google sign-in/consent must use the system browser; embedding Google's login in an Electron webview is not the supported approach.

## Publisher steps (once per application)

1. [Create/select a Google Cloud project](https://console.cloud.google.com/projectcreate).
2. Enable [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) and [YouTube Analytics API](https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com) in that same project.
3. Set up [Branding](https://console.cloud.google.com/auth/branding), [Audience](https://console.cloud.google.com/auth/audience), and [Data access](https://console.cloud.google.com/auth/scopes). Use the app's actual support/contact information and required public policy pages. Declare only `youtube.readonly` and `yt-analytics.readonly`. Add test users while testing; complete Google's applicable publishing/verification requirements before broader distribution. Project quotas and authorization policy are managed by the publisher.
4. In [Clients](https://console.cloud.google.com/auth/clients), create application type **Desktop app** and download the JSON while it is available. Do not use a Web application or service-account client.
5. In the repository's **Settings → Secrets and variables → Actions**, create the secret `CREATOR_DESK_GOOGLE_DESKTOP_CLIENT_JSON` with the downloaded Desktop JSON as its value. Do not paste it into a PR, issue, or source file.
6. Build a new release from `main`. The workflow supplies this value only to the trusted main-branch build. PR builds receive no publisher configuration. Set the secret before merging the version you want to ship. Changing a secret cannot update an already published installer; publish a new version rather than overwriting released assets.
7. Smoke-test real Google consent, channel totals, and Analytics using an authorized channel, then verify a fresh installation reaches Connect YouTube without JSON import. Automated tests use fixtures and do not establish Google's approval or a real account's access.

The build validates the Desktop JSON and writes a normalized `dist/main/google-client.json` containing only the two application client fields. Empty configuration removes a stale generated file; malformed or Web-client input fails the build without logging the value. Generated files are ignored by Git. Locally, the same environment variable can be supplied before building.

## What is public and what stays protected

Desktop applications are **public OAuth clients**. The bundled client configuration, including a field named `client_secret` in Google's Desktop JSON, can be inspected in a distributed app and must not be treated as a confidential server secret. Storing it as an Actions secret keeps it out of Git; it does not make it secret inside the installer. Never supply Web/server credentials, user access/refresh tokens, or service-account keys to this build setting.

User authorization tokens still use the OS protected vault and are excluded from backups. Tokens are tied to the client with which that account was authorized. Imported custom Desktop configuration remains supported as an advanced option and takes precedence over the app default. Switching configurations requires disconnecting existing workspace connections first; users can return to the app default when included.

## Builds without publisher configuration

These remain usable with local features and imports. Settings explicitly says no Google application is preconfigured and shows a guided setup with clickable/copyable URLs for the exact console pages. The renderer passes only named destination IDs to a validated main-process allowlist; it cannot request arbitrary external URLs.

## Official references

- [Google Desktop OAuth, public clients, PKCE, and loopback callbacks](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google OAuth policies and embedded user-agents](https://developers.google.com/identity/protocols/oauth2/policies)
- [Consent configuration](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Manage OAuth clients](https://support.google.com/cloud/answer/15549257?hl=en)
