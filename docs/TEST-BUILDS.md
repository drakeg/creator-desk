# Test Creator Desk features before the next formal release

Creator Desk is a desktop app. Every pull request targeting `main` already runs the **Desktop releases** GitHub Actions workflow for four native targets:

- `mac-arm64`: Apple Silicon Mac installer and ZIP
- `mac-x64`: Intel Mac installer and ZIP
- `windows-x64`: Windows installer and ZIP
- `linux-x64`: Debian/Ubuntu DEB package

## Fastest path to testing a new feature

1. Open the feature's pull request, click **Checks**, and open its **Desktop releases** run.
2. Only after your platform's job has finished successfully, open the workflow run's **Summary** page and scroll to **Artifacts**.
3. Download the ZIP artifact named for your target above. Extract it to access the installer/archive. The workflow retains these preview artifacts for 14 days.
4. Test the feature in a separate local workspace. Preserve a backup of your existing Creator Desk data before experimenting.
5. Report the PR link, OS, exact steps and observed result. A preview artifact is for testing and must not be called a published or verified release if other platform jobs are failing.

These are built from the **exact PR branch**. A later edit to a PR starts a new run, and you should use the most recent successful run for the revision you want to test. Some builds may not include the publisher-managed Google OAuth client, because it is only injected on trusted `main` builds; use a previously configured app/client as supported, or wait for the official release for the simplest Google sign-in experience. Do not share OAuth client secrets or tokens in bug reports.

## Formal releases

Official installers are published at https://github.com/drakeg/creator-desk/releases only after a new version is committed to `main`, every native platform build passes, installation and Electron UI tests succeed, and release assets/checksums are verified.

A merge alone does **not** create a new release of the same version. Version bumps will happen more frequently as coherent user-facing features are ready, while PR preview artifacts allow earlier hands-on testing.

## Limits

- macOS preview binaries are ad hoc signed but not notarized. Windows installers are unsigned.
- Native workflows use synthetic media and API fixtures for automated tests; verify behavior with an authorized real channel yourself.
- YouTube Public API topic research is quota-bounded. The proprietary vidIQ keyword demand metrics aren't available through the standard API.
- Public/competitor videos are research data only. Shorts source selection is restricted to your own connected channel or local media you own.
