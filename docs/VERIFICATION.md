# Creator Desk 0.1.0 verification

Verified October 28, 2026 on macOS 27.0.1 (26A434), Apple Silicon arm64.

## Result

The desktop-core preview is implemented and packaged as a local app, ZIP and DMG. A copy extracted from the mounted DMG passed the Electron interaction tests. All build-image attachments created during verification were ejected. No installation into /Applications or use of the real application data directory was performed.

The app includes workspace creation/rename/selection, persistence, appearance, collapsible navigation and backup/restore. It contains clearly labeled planned states for the rest of the approved capability map. CSV/JSON channel imports, OAuth, analytics, competitors, research, AI tools and media tools are not implemented in this release.

## Checks passed

- 14 unit/integration tests using real SQLite/filesystem data: restart persistence, invalid inputs, transaction rollback, future database versions, refused writes, backup round trips, credential exclusion, invalid containers/databases, expired/cancelled/changed previews, restore rollback, oversized files and symlink rejection. Credential-service tests use an injected protector; they do not verify live Keychain authorization.
- 4 Electron tests against the application copied out of the DMG: onboarding/settings/workspace selection across restart; backup preview/cancel/restore across restart; renderer sandbox/API/input rejection; second-launch behavior.
- TypeScript type checking and ESLint.
- Production build. Five packaged runtime files match the final local build byte-for-byte.
- Fresh `npm ci --ignore-scripts --offline`, followed by the reviewed `npm run bootstrap` command.
- npm audit: zero known vulnerabilities, including the full development graph at final installation.
- Registry signatures: 298 verified packages; 111 verified attestations.
- Backup hash-validation mutation: removing the hash check made its test fail; the check was restored and the suite passed.
- Visual review: light/dark, onboarding, compact 960×640 window, collapsible sidebar, planned states. Test console captured no renderer errors. Automated tests replace native file picker results with test paths; native picker interaction itself was not automated.
- Ad-hoc app signature verified with `codesign --verify --deep --strict`.
- DMG mounted; app and Applications shortcut found; copied app matched the source bundle's app.asar SHA-256; copied app signature verified; volume ejected.

## Runtime versions

- Electron 45.1.0
- Chromium 156.0.8078.49
- Bundled Node 24.22.1
- Bundled SQLite 3.53.4
- React 19.3.1, TypeScript 6.0.3, Vite 8.3.5
- Development Node 22.23.4 and npm 12.2.1
- App version 0.1.0; embedded macOS minimum 13.0, not verified on older systems.

## REA evidence

- DMG build: ev_33ee1df0ca74da294a9d2403edca30fc50f74738375e65002a67b986b1dd2c3e.
- Mounted-image/copy/signature/content verification: ev_ac6e9d92e2b7852a7bed3184668dc358e01bce752612159c99071f6e6500dc0a.
- Final copied-app Electron tests: ev_dd224905d7b74093bc87a6af267f32484de9620b6a86f0c1ca84242cc740320e.
- Verified app.asar SHA-256: 35225ac5866cb28ea089365d8a87454bc90030cf3112bd043f6b260f39b3a73a.

Full process evidence is retained in the task's work/evidence directory. REA's root-process cleanup was verified; process sampling is incomplete for some unrelated/platform processes. The evidence does not establish complete process or network tracing. No network behavior is inferred from process captures.

## Platform adaptations

The restricted shell aborted GUI startup during macOS application registration, so REA's process workflow ran the Electron tests. Legacy hdiutil creation/attachment failed or hung on this host. The build uses macOS 27's diskutil image command instead. Verification used the actual APFS mount point reported by the OS, cleaned up only attachments backed by this generated image, and ejected the final test image.

The DMG maker dependency was removed after an audit flagged its transitive image parser. Apple tools create the image, avoiding that dependency. Node's built-in SQLite binding avoids a separate native addon and was tested in the packaged runtime.

## Limits

This is a local, ad-hoc-signed preview. It is not Developer ID signed or notarized. Intel, Windows, App Store delivery, auto-updates, live YouTube/OAuth, live Keychain access and external AI providers were not tested. No existing schema migration is needed for schema 1; future migrations must add pre-migration backups. Backup format 1 supports SQLite/settings only, up to 24 MB of database data / 32 MB per file, without media attachments.
