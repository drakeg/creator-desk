Creator Desk 0.9 fixes imported impressions and adds FFmpeg setup inside Studio.

- Imports YouTube Studio's Thumbnail impressions column and displays sortable per-record impressions. Re-import Table data.csv to restore values ignored by older versions.
- Import notes now show the exact reported total, individual-row sum, and difference. Summary Total rows remain excluded to prevent double-counting. Duration and thumbnail click-through rate remain unsupported.
- Set up FFmpeg with one app action: a pinned, checksum-verified upstream download, no separate installer or administrator access. Processing works offline after setup. An existing FFmpeg executable remains an advanced option.
- FFmpeg downloads directly from Jellyfin; its matching GPLv3 source/build information is linked in Studio. Media tools, source videos, and Shorts drafts remain outside database backups.

Downloads cover Apple Silicon/Intel macOS, Windows x64, and Debian/Ubuntu Linux x64. macOS builds are ad hoc signed and not notarized; Windows builds are unsigned. Checksums are included.
