# Transcript editing for Shorts

Make imported and AI-generated timed captions useful without another editor. Keep the existing Studio layout, controls, spacing and theme. Add a searchable transcript with at most 50 visible cues per page, play a cue in the existing preview, and use cue boundaries to trim a Short. Preserve the other clip boundary when it yields a valid 1–180-second clip; otherwise choose up to 60 seconds within the source. Editing trim points still requires Save clip draft to persist.

Edit one caption's text and start/end seconds in the existing modal pattern. Save explicitly to local storage; cancellation changes nothing. Require nonempty text, valid source-bounded timing, existing transcript limits, and no active media/AI job. Reject stale edits when the source or original cue no longer matches. Preserve the draft and clear AI suggestions after a correction. Future AI requests and caption exports use the corrected transcript; no network request occurs when editing or saving.

Show empty search results, saved/error states, counts, pagination, descriptive button labels and keyboard-accessible controls. Keep the text editor available on small desktop windows. Source files and existing exported files remain untouched. No new AI permissions or provider changes. Current backup exclusions still apply.

Verify invalid/stale/cross-workspace edits, persistence after restart, clip-boundary selection, cancellation, search/pagination, cue playback, and corrected text/timing in an actual exported SRT sidecar.
