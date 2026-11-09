# Analytics completeness

Import optional video duration in seconds (numeric or MM:SS/HH:MM:SS) and CTR percentages in the range 0–100. Show and sort these per record; do not average percentages or sum durations into channel metrics. Missing values stay unavailable. Preserve old snapshots/backups and deduplication for files without the new fields.

Allow a workspace-owned report to have a display name independent of its original channel/provenance. Deletion first marks the report deleted and hides it from the active selector. Deleted reports can be restored and remain in database backups. Permanent removal is only available for already-deleted reports, behind a separate explicit confirmation. Retained deleted reports count toward current storage limits; permanent removal frees that storage. Reimporting an identical deleted snapshot restores it.

Validate all IPC actions, scope all operations to the selected workspace, preserve original files and other reports, and verify rename/delete/restore/permanent removal, backup compatibility, invalid metrics, and the installed UI. Correct stale placeholder text without implying Research, Competitors or Projects are implemented.
