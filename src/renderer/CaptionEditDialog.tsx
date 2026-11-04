import { useState, type FormEvent } from "react";
import type { Cue, ShortsState } from "../shared/shorts";
import { Modal } from "./Dialog";
interface Props {
  index: number;
  original: Cue;
  sourceURL: string;
  duration: number;
  onClose: () => void;
  onSaved: (state: ShortsState) => void;
}
export function CaptionEditDialog({
  index,
  original,
  sourceURL,
  duration,
  onClose,
  onSaved,
}: Props) {
  const [text, setText] = useState(original.text);
  const [start, setStart] = useState(String(original.start));
  const [end, setEnd] = useState(String(original.end));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!text.trim() || Number(end) <= Number(start)) {
      setError("Enter caption text and an end time after its start.");
      return;
    }
    setBusy(true);
    try {
      const result = await window.desktop.shorts.updateCue({
        sourceURL,
        index,
        original,
        updated: { start: Number(start), end: Number(end), text },
      });
      if (result.ok) {
        onSaved(result.value);
        onClose();
      } else setError(result.error.message);
    } catch {
      setError(
        "The caption could not be saved. Your previous transcript is preserved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Edit caption ${index + 1}`} busy={busy} onClose={onClose}>
      <form
        onSubmit={(event) => void save(event)}
        className="caption-edit-form"
      >
        <p className="dialog-copy">
          Correct the wording or timing. Saving updates local captions and
          clears old AI suggestions; your clip draft stays intact.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="studio-form-grid">
          <label>
            Caption start (seconds)
            <input
              type="number"
              min={0}
              max={duration}
              step="any"
              required
              value={start}
              disabled={busy}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label>
            Caption end (seconds)
            <input
              type="number"
              min={0}
              max={duration}
              step="any"
              required
              value={end}
              disabled={busy}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        </div>
        <label htmlFor="caption-text">Caption text</label>
        <textarea
          id="caption-text"
          autoFocus
          required
          maxLength={2000}
          rows={5}
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="field-note">
          {text.length} / 2,000 characters. No AI request is made when saving.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Discard changes
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Saving caption…" : "Save caption"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
