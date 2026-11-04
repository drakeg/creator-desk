import { useState } from "react";
import type { Cue, ShortsState } from "../shared/shorts";
import { CaptionEditDialog } from "./CaptionEditDialog";
interface Props {
  cues: Cue[];
  source: NonNullable<ShortsState["source"]>;
  disabled: boolean;
  onPlay: (cue: Cue) => void;
  onBoundary: (boundary: "start" | "end", time: number) => void;
  onSaved: (state: ShortsState) => void;
}
const pageSize = 50;
export function TranscriptPanel({
  cues,
  source,
  disabled,
  onPlay,
  onBoundary,
  onSaved,
}: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ index: number; cue: Cue } | null>(
    null,
  );
  const needle = query.trim().toLocaleLowerCase();
  const matching = cues
    .map((cue, index) => ({ cue, index }))
    .filter(
      ({ cue }) => !needle || cue.text.toLocaleLowerCase().includes(needle),
    );
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = matching.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <>
      <details className="transcript-panel">
        <summary>Review timed transcript</summary>
        <p className="field-note">
          Play captions in the preview above, use their timing to trim, or
          correct their wording. Save clip draft to keep trim changes. If a
          boundary would make an invalid clip, its opposite end adjusts to fit
          up to 60 seconds.
        </p>
        <label className="transcript-search">
          Search transcript
          <input
            type="search"
            maxLength={200}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <p className="field-note" role="status">
          {matching.length} matching captions · {cues.length} total
          {matching.length
            ? ` · showing ${currentPage * pageSize + 1}–${currentPage * pageSize + visible.length}`
            : ""}
        </p>
        <div className="transcript-cues">
          {!matching.length && (
            <p>No captions match this search. Try another phrase.</p>
          )}
          {visible.map(({ cue, index }) => (
            <article
              className="transcript-cue"
              key={index}
              aria-label={`Caption ${index + 1}`}
            >
              <p className="field-note">
                Caption {index + 1} · {cue.start.toFixed(2)}–
                {cue.end.toFixed(2)}s
              </p>
              <p className="caption-text">{cue.text}</p>
              <div className="youtube-actions">
                <button
                  className="button secondary"
                  disabled={disabled}
                  aria-label={`Play caption ${index + 1}`}
                  onClick={() => onPlay(cue)}
                >
                  Play
                </button>
                <button
                  className="button secondary"
                  disabled={disabled || source.duration - cue.start < 1}
                  aria-label={`Start clip at caption ${index + 1}`}
                  onClick={() => onBoundary("start", cue.start)}
                >
                  Start here
                </button>
                <button
                  className="button secondary"
                  disabled={disabled || cue.end < 1}
                  aria-label={`End clip at caption ${index + 1}`}
                  onClick={() => onBoundary("end", cue.end)}
                >
                  End here
                </button>
                <button
                  className="button secondary"
                  disabled={disabled}
                  aria-label={`Edit caption ${index + 1}`}
                  onClick={() => setEditing({ index, cue })}
                >
                  Edit caption
                </button>
              </div>
            </article>
          ))}
        </div>
        {pages > 1 && (
          <nav aria-label="Transcript pages" className="youtube-actions">
            <button
              className="button secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous captions
            </button>
            <span>
              Page {currentPage + 1} of {pages}
            </span>
            <button
              className="button secondary"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next captions
            </button>
          </nav>
        )}
      </details>
      {editing && (
        <CaptionEditDialog
          index={editing.index}
          original={editing.cue}
          sourceURL={source.url}
          duration={source.duration}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
