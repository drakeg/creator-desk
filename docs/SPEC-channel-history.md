# Connected channel workflow

One primary Sync channel history action retrieves the channel identity, all returned uploads (pagination, no 100-video truncation), and daily views/watch time/subscriber change from channel creation through the last completed UTC day. Requests use nonoverlapping windows of at most 366 days. Empty windows are valid; absent days remain absent. API processing delay and missing Studio-only metrics are explained, not represented as zero. Unknown creation dates fall back to YouTube's launch year, explicitly labelled.

The connected Dashboard defaults to locally cached history with date presets/custom dates, daily chart, summary metrics, and a searchable video library labelled as cumulative views. CSV imports and existing snapshot management remain available in a separate secondary view. This is the first channel-history slice; it does not claim every API dimension, per-video date filtering, retention, revenue, reach, or public research/competitor analysis is implemented.

Sync has visible progress, cancellation, one job per workspace, workspace/account checks before commit, and atomic publication. Failed/cancelled refreshes preserve previous history. Managed history replaces its previous reports rather than accumulating snapshots. Backups include cached history but exclude credentials. Unavailable upload metadata is disclosed; unsupported sizes fail explicitly instead of silently truncating. On first visiting a connected channel without cached history, start its first sync once; subsequent refreshes are user initiated. No repeated automatic retry after failure.

Research, Competitors and Projects are visibly planned in navigation; their screens explain that syncing cannot unlock them and have no misleading setup checklist.

Sources: https://developers.google.com/youtube/analytics/reference/reports/query (date ranges, delayed metrics); https://developers.google.com/youtube/analytics/channel_reports (supported reports); https://developers.google.com/youtube/v3/docs/playlistItems/list (pagination); https://developers.google.com/youtube/v3/docs/channels (creation date).
