Creator Desk 0.7.1 updates the desktop runtime and maintains reliable dependency builds.

- Updated Electron to 45.2.1, including upstream Chromium fixes.
- Updated ESLint and retained the supported TypeScript compiler range.
- Dependency-only merges preserve existing published downloads instead of failing or replacing them. New installer versions still require all native build and installed-app checks.

Includes the Google setup improvements from 0.7: exact setup links and optional publisher-configured sign-in. See docs/GOOGLE-PUBLISHER-SETUP.md for activation; no real publisher credentials are bundled in source.

Downloads cover Apple Silicon/Intel macOS, Windows x64, and Debian/Ubuntu Linux x64. macOS builds are ad hoc signed and not notarized; Windows builds are unsigned. Checksums are included.
