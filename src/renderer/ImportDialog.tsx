import { useState } from "react";
import { FileSpreadsheet, Check } from "lucide-react";
import type { CommitImportInput, ImportPreview } from "../shared/analytics";
import { Modal } from "./Dialog";
interface Props {
  preview: ImportPreview;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onCommit: (input: CommitImportInput) => void;
}
export function ImportDialog({
  preview,
  busy,
  error,
  onCancel,
  onCommit,
}: Props) {
  const [channelName, setChannelName] = useState(preview.workspaceName);
  const [start, setStart] = useState(preview.periodStart ?? "");
  const [end, setEnd] = useState(preview.periodEnd ?? "");
  const [unknown, setUnknown] = useState(false);
  return (
    <Modal title="Preview channel report" busy={busy} onClose={onCancel}>
      <p className="dialog-copy">
        Review this report before adding it to{" "}
        <strong>{preview.workspaceName}</strong>. It will be saved as a separate
        snapshot.
      </p>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      <div className="import-file">
        <FileSpreadsheet size={22} />
        <div>
          <strong>{preview.fileName}</strong>
          <span>
            {preview.rowCount.toLocaleString()}{" "}
            {preview.kind === "videos" ? "video" : "daily"} records ·{" "}
            {preview.metrics.length} supported metrics
          </span>
        </div>
        <Check size={18} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCommit({
            previewId: preview.previewId,
            channelName,
            periodStart: unknown ? null : start || null,
            periodEnd: unknown ? null : end || null,
            periodUnknown: unknown,
          });
        }}
      >
        <label htmlFor="channel-label">Channel / report label</label>
        <input
          id="channel-label"
          value={channelName}
          maxLength={100}
          onChange={(e) => setChannelName(e.target.value)}
          required
          disabled={busy}
        />
        <fieldset className="report-period">
          <legend>Report period</legend>
          <p>
            {preview.kind === "daily"
              ? "Detected from the dates in your file."
              : "Use the same dates you selected in YouTube Studio. Publication dates do not describe the reporting period."}
          </p>
          <div className="date-fields">
            <div>
              <label htmlFor="period-start">Start date</label>
              <input
                type="date"
                id="period-start"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={busy || unknown || preview.kind === "daily"}
                required={!unknown}
              />
            </div>
            <div>
              <label htmlFor="period-end">End date</label>
              <input
                type="date"
                id="period-end"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
                disabled={busy || unknown || preview.kind === "daily"}
                required={!unknown}
              />
            </div>
          </div>
          {preview.kind === "videos" && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={unknown}
                onChange={(e) => setUnknown(e.target.checked)}
                disabled={busy}
              />
              Period unknown / lifetime export
            </label>
          )}
        </fieldset>
        <div className="import-sample">
          <span className="eyebrow">FIRST RECORDS</span>
          {preview.sample.map((r) => (
            <div key={r.id}>
              <span>{preview.kind === "videos" ? r.title : r.date}</span>
              <strong>{r.views.toLocaleString()} views</strong>
            </div>
          ))}
        </div>
        {preview.warnings.length > 0 && (
          <details className="import-warnings">
            <summary>
              {preview.warnings.length} import note
              {preview.warnings.length === 1 ? "" : "s"}
            </summary>
            <ul>
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
        <p className="field-note">
          Data stays on this Mac. Re-importing the same data with the same label
          and period won’t duplicate it.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !channelName.trim() ||
              (!unknown && (!start || !end || start > end))
            }
          >
            {busy ? "Importing…" : "Import report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
