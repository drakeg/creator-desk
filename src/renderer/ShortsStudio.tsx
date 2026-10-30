import { useEffect, useRef, useState } from "react";
import type { ShortsState, Clip } from "../shared/shorts";
import type { Result } from "../shared/contracts";
import { AIProvider } from "./AIProvider";
export function ShortsStudio() {
  const [state, setState] = useState<ShortsState | null>(null);
  const [draft, setDraft] = useState<Clip | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const hasJob = !!state?.job;
  useEffect(() => {
    let active = true;
    const load = () =>
      void window.desktop.shorts
        .get()
        .then((result) => {
          if (!active) return;
          if (result.ok) {
            setState(result.value);
            setDraft((current) => current ?? result.value.draft);
          } else setError(result.error.message);
        })
        .catch(() => {
          if (active) setError("Shorts Studio could not load.");
        });
    load();
    const timer = hasJob ? setInterval(load, 700) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [hasJob]);
  async function perform(operation: () => Promise<Result<ShortsState>>) {
    setWorking(true);
    setError("");
    try {
      const result = await operation();
      if (result.ok) {
        setState(result.value);
        if (result.value.source?.url !== state?.source?.url) {
          setDraft(result.value.draft);
          setPreviewError(false);
        }
      } else setError(result.error.message);
    } catch {
      setError("The operation could not finish. Your saved work is preserved.");
    } finally {
      setWorking(false);
    }
  }
  const busy = working || hasJob;
  const update = (patch: Partial<Clip>) =>
    setDraft((value) => (value ? { ...value, ...patch } : value));
  return (
    <div className="shorts-content">
      <div className="studio-intro">
        <h2>Turn a long video into your next Short.</h2>
        <p>
          Find strong moments, review the framing, and export a vertical clip.
          AI is optional; your original stays untouched.
        </p>
      </div>
      {(error || state?.error) && (
        <div className="alert" role="alert">
          {error || state?.error}
        </div>
      )}
      {state?.notice && <p role="status">{state.notice}</p>}
      {state?.job && (
        <div className="studio-job" role="status">
          <span>
            {state.job.type}
            {state.job.type === "Exporting Short"
              ? "…"
              : ` · ${Math.round(state.job.progress * 100)}%`}
          </span>
          <button
            className="button secondary"
            disabled={working}
            onClick={() => void perform(() => window.desktop.shorts.cancel())}
          >
            Cancel job
          </button>
        </div>
      )}
      <div className="youtube-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void perform(() => window.desktop.shorts.chooseFFmpeg())
          }
        >
          {state?.ffmpegReady
            ? "Change FFmpeg executable"
            : "Choose installed FFmpeg"}
        </button>
        <button
          className="button primary"
          disabled={busy || !state?.ffmpegReady}
          onClick={() =>
            void perform(() => window.desktop.shorts.chooseVideo())
          }
        >
          {state?.source
            ? "Replace video (resets draft)"
            : "Choose source video"}
        </button>
      </div>
      {!state?.ffmpegReady && (
        <p className="field-note">
          Install FFmpeg, then choose its executable (for example
          /opt/homebrew/bin/ffmpeg on an Apple Silicon Mac). MP4, MOV, M4V, and
          WebM sources up to six hours / 20 GB are supported.
        </p>
      )}
      {state?.source && draft && (
        <div className="studio-editor">
          <div className="studio-preview">
            <div className="vertical-video">
              <video
                ref={video}
                key={state.source.url}
                src={state.source.url}
                controls
                preload="metadata"
                style={{
                  objectFit: draft.fit === "crop" ? "cover" : "contain",
                  objectPosition: `${draft.focus * 100}% center`,
                }}
                onError={() => setPreviewError(true)}
                onTimeUpdate={() => {
                  if (video.current && video.current.currentTime >= draft.end)
                    video.current.pause();
                }}
              />
            </div>
            <button
              className="button secondary"
              onClick={() => {
                if (video.current) {
                  video.current.currentTime = draft.start;
                  void video.current.play().catch(() => setPreviewError(true));
                }
              }}
            >
              Preview selected clip
            </button>
            {previewError && (
              <p className="field-note">
                This source codec may not preview in the desktop player. FFmpeg
                export can still process supported source files.
              </p>
            )}
            <p className="field-note">
              720 × 1280 export · {state.source.name} ·{" "}
              {state.source.duration.toFixed(1)} seconds
            </p>
          </div>
          <div className="studio-edit-controls">
            <h3>Edit your clip</h3>
            <label>
              Short title
              <input
                value={draft.title}
                maxLength={100}
                disabled={busy}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <div className="studio-form-grid">
              <label>
                Start (seconds)
                <input
                  type="number"
                  min={0}
                  max={state.source.duration}
                  step={0.1}
                  value={draft.start}
                  disabled={busy}
                  onChange={(e) => update({ start: Number(e.target.value) })}
                />
              </label>
              <label>
                End (seconds)
                <input
                  type="number"
                  min={0}
                  max={state.source.duration}
                  step={0.1}
                  value={draft.end}
                  disabled={busy}
                  onChange={(e) => update({ end: Number(e.target.value) })}
                />
              </label>
            </div>
            <p className="field-note">
              {(draft.end - draft.start).toFixed(1)} seconds selected. Export
              supports 1–180 seconds.
            </p>
            <label>
              Framing
              <select
                value={draft.fit}
                disabled={busy}
                onChange={(e) => update({ fit: e.target.value as Clip["fit"] })}
              >
                <option value="crop">Fill vertical frame</option>
                <option value="fit">Fit entire video with black padding</option>
              </select>
            </label>
            {draft.fit === "crop" && (
              <label>
                Horizontal focus
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={draft.focus}
                  disabled={busy}
                  onChange={(e) => update({ focus: Number(e.target.value) })}
                />
              </label>
            )}
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={draft.captions}
                disabled={busy || !state.cues.length}
                onChange={(e) => update({ captions: e.target.checked })}
              />
              Burn captions into video (requires FFmpeg subtitle support)
            </label>
            <p className="field-note">
              Timed captions also export as an SRT sidecar. Review transcript
              accuracy before publishing.
            </p>
            <div className="youtube-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void perform(() => window.desktop.shorts.saveDraft(draft))
                }
              >
                Save clip draft
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void perform(() => window.desktop.shorts.exportClip(draft))
                }
              >
                Export vertical MP4
              </button>
            </div>
          </div>
        </div>
      )}
      {state?.source && (
        <section className="studio-transcript">
          <h3>Transcript and AI suggestions</h3>
          <p>
            Import timed captions, or send audio to your selected speech
            provider. Then ask your selected model to find clips.
          </p>
          <div className="youtube-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void perform(() => window.desktop.shorts.importTranscript())
              }
            >
              Import SRT / VTT
            </button>
            <button
              className="button secondary"
              disabled={busy || !state.providers.speech?.config.allowed}
              onClick={() =>
                void perform(() => window.desktop.shorts.transcribe())
              }
            >
              Transcribe audio with selected AI
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                !state.cues.length ||
                !state.providers.clips?.config.allowed
              }
              onClick={() =>
                void perform(() => window.desktop.shorts.suggest())
              }
            >
              Suggest clips with selected AI
            </button>
          </div>
          <p className="field-note">
            {state.cues.length} timed cues. Speech destination:{" "}
            {state.providers.speech?.config.baseURL ?? "none"}. Transcript
            destination: {state.providers.clips?.config.baseURL ?? "none"}.
          </p>
          {state.cues.length > 0 && (
            <details>
              <summary>Review timed transcript</summary>
              <div className="transcript-cues">
                {state.cues.map((c, i) => (
                  <p key={i}>
                    <strong>
                      {c.start.toFixed(1)}–{c.end.toFixed(1)}s
                    </strong>{" "}
                    {c.text}
                  </p>
                ))}
              </div>
            </details>
          )}
          {state.suggestions.map((suggestion, i) => (
            <article className="clip-suggestion" key={i}>
              <div>
                <h4>{suggestion.title}</h4>
                <p>
                  {suggestion.start.toFixed(1)}–{suggestion.end.toFixed(1)}s ·{" "}
                  {suggestion.reason}
                </p>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setDraft(suggestion);
                  void perform(() =>
                    window.desktop.shorts.saveDraft(suggestion),
                  );
                }}
              >
                Use suggestion {i + 1}
              </button>
            </article>
          ))}
        </section>
      )}
      <section className="studio-providers">
        <h3>Choose your AI and its access</h3>
        <p>
          Use local Ollama for transcript analysis, or a compatible hosted/local
          server. Speech needs a transcription endpoint that returns timed
          segments. No provider is selected automatically.
        </p>
        {(["clips", "speech"] as const).map((purpose) => (
          <AIProvider
            key={`${purpose}:${state?.providers[purpose]?.config.baseURL ?? ""}:${state?.providers[purpose]?.config.model ?? ""}:${state?.providers[purpose]?.config.allowed ?? false}`}
            purpose={purpose}
            status={state?.providers[purpose]}
            disabled={busy}
            perform={perform}
          />
        ))}
      </section>
      <p className="field-note">
        Shorts drafts are saved per workspace. Source videos, transcripts, and
        Shorts drafts are outside current database backups; keep your source and
        exported files separately. AI keys are excluded from backups.
      </p>
    </div>
  );
}
