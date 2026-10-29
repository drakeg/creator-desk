# Specification: desktop-core

Status: approved by the user and implemented as the 0.1.0 desktop-core preview on October 28, 2026. See the release verification report for tested behavior and limitations.
Parent: CAPABILITY-MAP.md, approved October 28, 2026.

## Objective

Provide the installable, local foundation for an independent Creator Desk application. A user can open the Mac app without an account, create or select a local workspace, navigate the available screens, change settings, quit and reopen without losing data, and export or restore a backup. Later modules add imported and live channel data through defined interfaces.

The first usable channel dashboard belongs to stage 1 as a whole, after desktop-core, data-connectors and channel-insights are implemented. Completing desktop-core alone does not establish that live YouTube integration or analytics works.

## Assumptions and proposed defaults

- Working app name: Creator Desk. This is a replaceable development name, not a claim of trademark availability.
- One macOS user can manage multiple local workspaces and, later, multiple channels within a workspace.
- Apple Silicon is the first tested architecture; this computer reports arm64. Intel compatibility is a later packaging check.
- Install by opening a DMG and dragging the app into Applications. Also provide a zipped app for local testing.
- No hosted backend, subscription, app login, telemetry, or automatic upload of local data.
- Network access is used by later connectors and user-selected AI providers. Core workflows work offline.
- Support the macOS versions supported by the chosen stable Electron release; record that exact minimum in the release manifest before packaging. Test the actual host OS, and do not claim other OS versions were tested.
- Direct distribution is the initial target. App Store submission and automatic updates are deferred.

## Scope and user experience

### First launch

Show a concise welcome screen explaining local storage, with Create workspace and Restore backup actions. A fresh install contains no invented subscriber counts, videos, or live insights. Optional sample data, if later added, must live in an explicitly labeled sample workspace.

Choose a default workspace name without requiring a form. Allow rename from Settings. Create the workspace in an app-managed data directory, not alongside the app bundle. Support names with spaces, punctuation, and Unicode; use generated identifiers for filenames.

### Desktop shell

Use a compact sidebar and a large content area. Provide Dashboard, Research, Competitors, Projects, Studio, and Settings navigation destinations. Only Settings and workspace management are functional in this module. Destinations whose provider modules are absent show a clear Planned state, an explanation of what will appear there, and no inactive imitation of a working tool.

Provide standard macOS application/Edit/Window/Help menus, including Quit, copy/paste, undo/redo where supported, and zoom controls. Remember window size and sidebar state with sensible bounds. A second launch activates the existing instance instead of opening another database writer.

Minimum window size: 960 by 640 logical pixels. At narrower supported widths, the sidebar collapses without hiding navigation labels from assistive technology. Use system fonts, neutral surfaces and one consistent accent. Support light, dark and system appearance, visible keyboard focus, reduced motion, and labeled form controls. Do not reuse third-party branding, copied imagery, proprietary copy, or source code.

### Workspace and settings

Settings supports workspace rename, appearance, data-location display, backup export and backup restore. App-managed directories are not arbitrarily writable from the renderer. Open-folder actions target only the current app data location. Do not implement permanent workspace deletion in this module.

Save changes immediately with a visible error if persistence fails. Do not show successful save confirmation until the database transaction commits. On restart, restore the selected workspace and appearance. Unknown settings from a newer database version are not silently removed.

### Backup and restore

Export a versioned backup package through a native Save dialog. Include a consistent SQLite snapshot, workspace metadata, declared module attachments, a manifest and hashes. Export all local workspaces in the backup for this initial version and disclose that scope in the UI. Export no OAuth tokens, API keys, cookies, temporary recordings, or decrypted credentials.

Use SQLite's supported backup mechanism rather than copying a database while its write-ahead log may be active. Stage output in a temporary location and replace the destination only after a successful write and verification. A cancelled dialog changes nothing.

Restore first validates format, supported schema, hashes, size limits and safe paths in a staging directory. Reject absolute paths, traversal, symlinks and unexpected members. Create and verify a pre-restore backup, then show workspace names and that restore replaces all local workspaces/settings. Require the user's explicit Restore action before replacement. Close database handles before swapping files; reopen and validate the replacement. If activation fails, restore the prior database and keep the pre-restore backup. Never display a success state while the app is still using the old database.

Credentials remain outside the backup and are not overwritten by restore. Restored account references without matching usable credentials must later be shown as needing reconnection, not connected.

### Failure behavior

Handle missing permissions, disk full, unavailable encryption, invalid backups, database version mismatch and interrupted saves with plain-language errors. Avoid raw stack traces and secret values in user-facing messages or diagnostic logs. Preserve the existing database on a failed migration or restore. If an app data directory is unwritable, offer retry and a diagnostic explanation; do not silently switch to an in-memory database.

## Proposed technology

Electron for the desktop host; React and TypeScript for bundled UI; Vite for development and UI bundling; Electron Forge for application packaging and DMG/ZIP makers; SQLite with a maintained Electron-compatible binding for persistence; Vitest for logic tests and Playwright for application interaction tests.

Resolve current stable, mutually compatible package versions at implementation time, pin exact versions in package.json/package-lock.json, and record Electron, Chromium, Node, SQLite, native binding and architecture versions in build metadata. No beta dependency is required. Verify a native SQLite binding against the packaged Electron runtime, not only the development Node runtime.

Electron is proposed because it packages a local UI and desktop runtime without a hosted server and fits the existing JavaScript tools. A Rust/Tauri toolchain was not found during initial inspection. This is an implementation choice, not a product requirement.

Distribution builds should be signed and notarized when the user's Apple Developer credentials are available. A local unsigned or ad-hoc-signed build can establish packaging and local behavior, but must be labeled as such; it does not establish notarized distribution. Do not request private signing keys in chat or weaken Gatekeeper to run a build.

## Architecture and module boundaries

The Electron main process owns SQLite, filesystem operations, native dialogs, operating-system integration and credentials. The sandboxed renderer receives only a narrow, typed preload bridge. Set contextIsolation=true, sandbox=true and nodeIntegration=false. Load bundled UI only, restrict navigation/new windows, set a restrictive content security policy, and validate IPC sender identity and every payload at runtime.

The preload bridge exposes named operations rather than arbitrary SQL, filesystem paths, shell execution, or general-purpose IPC access. The renderer may not directly read credentials. External links must use an approved HTTPS destination and open in the system browser.

Provider modules receive repositories/services from desktop-core; they do not read database files directly. Transactions, migrations and workspace scoping are enforced centrally. Core accepts module migrations and backup attachment registrations through code-owned declarations. It does not execute plugins downloaded at runtime.

### Initial service contract

```ts
type CoreErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_BACKUP"
  | "CANCELLED";

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: CoreErrorCode; message: string } };

interface DesktopCore {
  getState(): Promise<Result<CoreState>>;
  createWorkspace(input: { name: string }): Promise<Result<Workspace>>;
  selectWorkspace(input: { id: string }): Promise<Result<CoreState>>;
  renameWorkspace(input: {
    id: string;
    name: string;
  }): Promise<Result<Workspace>>;
  updateAppearance(input: {
    mode: "system" | "light" | "dark";
  }): Promise<Result<CoreState>>;
  exportBackup(): Promise<Result<{ cancelled: boolean }>>;
  inspectRestore(): Promise<Result<RestorePreview | null>>;
  confirmRestore(input: { previewId: string }): Promise<Result<CoreState>>;
  openDataFolder(): Promise<Result<null>>;
}
```

CoreState contains workspace summaries, selected workspace ID, settings and app version. Workspace contains a generated ID, display name and creation/update timestamps. RestorePreview identifies the staged backup, format version and replacement workspace names. Preview IDs are opaque, short-lived and bound to the validated staged bytes; confirmRestore never accepts an arbitrary renderer-supplied file path. An inspectRestore cancellation returns null.

Cancellation is expected behavior, not a generic failure toast. Channel queries, CSV parsing, OAuth and AI operations belong to later modules and are absent from this bridge until specified.

### Storage

Use app.getPath('userData') for the application data root. SQLite stores schema/migration history, workspaces and typed settings. Attachments use generated paths under that root. Create pre-migration backups and apply migrations transactionally. Fail safely if the database is newer than the running application supports.

Credential storage is a main-process service for later modules. On macOS, use Keychain-backed protection. Electron safeStorage is acceptable if encryption availability is verified: encryption keys are protected by Keychain, and encrypted credential payloads are stored in an app-managed restricted file. Do not describe safeStorage as storing every token directly in Keychain. Credential values must never enter the renderer, logs or ordinary backups. If protected storage is unavailable, return a clear error without plaintext fallback.

## Project structure

Implementation root: work/creator-desk/. Final app packages, source archive and user documentation go in outputs/.

```text
src/main/           Desktop lifecycle, windows, IPC handlers, OS services
src/main/storage/   SQLite repositories, migrations, backups
src/preload/        Narrow renderer bridge
src/shared/         Contracts and runtime validation
src/renderer/       React screens, styles and accessible components
tests/unit/         Validation, storage and backup tests
tests/e2e/          Packaged app interaction and restart tests
docs/               Development and architecture notes
forge.config.ts     Packaging, makers and distribution settings
```

## Commands to implement

These scripts are acceptance requirements for the future project; they do not exist yet.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run package -- --arch=arm64
npm run make -- --arch=arm64
```

The e2e command uses an isolated test data directory and never touches the user's real application database. The make command produces an arm64 DMG and ZIP. Document signing environment separately; no signing secret belongs in package scripts or tracked configuration.

## Code style

Use strict TypeScript, function components, explicit error results at IPC boundaries, parameterized SQL and schema validation at input boundaries. Separate storage and OS operations from UI code. Keep changes narrow and verifiable. Use a formatter and lint rules configured in the initial project.

The service contract above is the naming/style example: named operations, object inputs, discriminated result types and no generic privileged escape hatch.

## Testing strategy and success criteria

1. Build an arm64 app bundle and DMG. Mount the DMG, copy the app to a temporary installation location, and launch the copied application without a development server. Inspect the mounted package contents and confirm the app's reported version. Do not install into /Applications without the required filesystem authorization.
2. Fresh launch offline: create a workspace, rename it, switch appearance, quit and reopen. All saved values survive; no network connection or login is necessary.
3. Create two workspaces and verify selection and settings persist without mixing workspace-owned records. A second launch focuses the existing instance.
4. Export a backup, change workspace/settings data, then restore. Confirm exact restored records and settings after restart. Verify secrets are absent from the exported package.
5. Invalid, truncated, future-version and path-traversal backups are rejected before modifying the current database. Cancellation and simulated restore-activation failures preserve existing records; pre-restore backups remain available.
6. Simulated transaction/write failures produce errors and no partial saved state. Migration failure rolls back and retains a usable pre-migration backup.
7. Verify context isolation, sandboxing, node integration disabled, navigation restrictions, CSP and IPC sender/payload checks. Confirm arbitrary renderer file paths and SQL cannot be submitted through the bridge.
8. Manually verify keyboard navigation, focus, labels, light/dark appearance, window resizing and empty/error states. Planned destinations have accurate status and no fabricated statistics.
9. Typecheck, lint, unit tests and e2e tests pass. Record actual commands/results, host macOS version, architecture and package hashes. Do not claim Intel, signing, notarization or another OS was tested without evidence.

Tests prioritize persistence, restore safety, isolation and packaging behavior. Do not impose arbitrary coverage percentages or tests that merely duplicate static UI markup.

## Boundaries

- Always: keep app data local by default, validate imported/restored inputs, preserve recoverable data on failure, run checks relevant to each change and accurately label incomplete features.
- Ask first: expand product scope, purchase services, publish externally, use paid AI credits, or change the user's security or credential configuration.
- Never: copy third-party credentials or browser session cookies into this app, commit secrets, fabricate live data, bypass security warnings, or discard failing tests to claim success.

Adding the ordinary dependencies needed for the approved implementation is within scope. Signing/notarization depends on suitable credentials and separate platform access; it does not prevent building a clearly labeled local test package.

## Open items

- Final product name can remain Creator Desk during development.
- Apple Developer signing/notarization availability can be resolved before distribution.
- AI provider choices and Google OAuth configuration belong to their module specifications and do not block desktop-core.

## Sources and evidence

- Approved capability map and REA/public plus signed-in UI observations: CAPABILITY-MAP.md.
- Electron introduction: https://www.electronjs.org/docs/latest/
- Context isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Process sandboxing: https://www.electronjs.org/docs/latest/tutorial/sandbox
- macOS safeStorage behavior: https://www.electronjs.org/docs/latest/api/safe-storage/
- Electron packaging: https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
- SQLite backups: https://www.sqlite.org/backup.html

## Next gate

The user approved this specification and explicitly requested coding. Desktop-core has now been implemented and packaged. The next module is data-connectors, followed by channel-insights. See the release verification report for implementation choices and any remaining limitations.
