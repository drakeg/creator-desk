Creator Desk 0.7 simplifies Google setup.

- Settings now provides exact clickable/copyable URLs for Google project creation, both YouTube APIs, app branding/audience/scopes, Desktop OAuth clients, and account connections.
- Publishers can configure a Desktop OAuth client when building a release, so users only click Connect YouTube and approve access in their system browser. Per-user Cloud project creation and JSON import become an advanced option.
- Builds without publisher configuration clearly show the manual guide. No real Google configuration or user tokens are included in source. Activating the default connection requires the publisher's own Google project/client and applicable Google verification.

See docs/GOOGLE-PUBLISHER-SETUP.md for activation. The desktop flow remains local with protected user tokens; no hosted app backend is required. Google sign-in uses the system browser.

Downloads cover Apple Silicon/Intel macOS, Windows x64, and Debian/Ubuntu Linux x64. macOS builds are ad hoc signed and not notarized; Windows builds are unsigned. Checksums are included.
