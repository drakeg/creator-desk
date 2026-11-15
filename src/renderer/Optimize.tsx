import { useEffect, useMemo, useState } from "react";
import type { ChannelHistory, YouTubeState } from "../shared/youtube";
import type { OptimizationResult } from "../shared/optimization";
import { optimizationAdvice } from "../shared/optimization";
import { ownedShortsUploads } from "../shared/owned-shorts";

export function Optimize() {
  const [connected, setConnected] = useState<YouTubeState | null>(null);
  const [history, setHistory] = useState<ChannelHistory | null>(null);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<OptimizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTags, setDraftTags] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([window.desktop.getYouTube(), window.desktop.getChannelHistory()])
      .then(([connection, records]) => {
        if (!active) return;
        if (connection.ok) setConnected(connection.value);
        else setError(connection.error.message);
        if (records.ok) setHistory(records.value);
        else setError(records.error.message);
      }).catch(() => { if (active) setError("Your channel library could not load."); });
    return () => { active = false; };
  }, []);
  const owned = ownedShortsUploads(connected, history);
  const advice = useMemo(() => data ? optimizationAdvice(data) : null, [data]);
  async function review() {
    setError(""); setData(null); setBusy(true);
    try {
      const r = await window.desktop.optimizeVideo({ videoId: selected });
      if (!r.ok) { setError(r.error.message); return; }
      setData(r.value);
      setDraftTitle(r.value.title);
      setDraftDescription(r.value.description);
      setDraftTags(r.value.tags.join(", "));
    } catch {
      setError("Could not load this video's metadata. Try again.");
    } finally { setBusy(false); }
  }
  return <section className="research-content" aria-label="Video optimization recommendations">
    <div className="studio-intro">
      <h2>Improve your video packaging</h2>
      <p>Review your published title, description and tags alongside specific, editable recommendations.
        Creator Desk makes no changes to YouTube.</p>
    </div>
    <div className="research-search">
      <label htmlFor="optimize-video">Choose one of your channel's uploads</label>
      <div className="youtube-actions">
        <select id="optimize-video" value={selected} disabled={busy}
          onChange={e => { setSelected(e.target.value); setData(null); }}>
          <option value="">Choose your video</option>
          {owned.map(v => <option key={v.id} value={v.id}>{v.title} ({v.id})</option>)}
        </select>
        <button className="button primary" type="button" disabled={busy || !selected}
          onClick={() => void review()}>{busy ? "Reviewing…" : "Review metadata"}</button>
      </div>
    </div>
    {!owned.length && <p className="field-note">Connect your YouTube channel and sync uploads in Dashboard first.
      Public or competitor videos are never eligible for this review.</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    {data && advice && <div className="optimize-report">
      <p className="field-note">Current YouTube metadata checked {new Date(data.fetchedAt).toLocaleString()}.
        This is a content-quality checklist, not a search-volume estimate or a promise of more views.</p>
      <h3>Recommendations</h3>
      <ul>
        {advice.tips.map((tip, i) => <li key={i}>
          <strong>{tip.label} ({tip.field})</strong> — {tip.reason}
        </li>)}
      </ul>
      {advice.candidateTags.length > 0 && <p><strong>Candidate phrases:</strong>{" "}
        {advice.candidateTags.join(", ")}. Only use those that accurately describe the video.</p>}
      <div className="change-fields">
        <label>Current title
          <textarea readOnly value={data.title} rows={2}/>
        </label>
        <label>Editable title draft
          <textarea value={draftTitle} onChange={e => setDraftTitle(e.target.value)} rows={2} maxLength={100}/>
        </label>
        <label>Current description
          <textarea readOnly value={data.description} rows={5}/>
        </label>
        <label>Editable description draft
          <textarea value={draftDescription} onChange={e => setDraftDescription(e.target.value)} rows={5} maxLength={5000}/>
        </label>
        <label>Current tags
          <textarea readOnly value={data.tags.join(", ")} rows={4}/>
        </label>
        <label>Editable tag draft (comma-separated)
          <textarea value={draftTags} onChange={e => setDraftTags(e.target.value)} rows={4}/>
        </label>
      </div>
      <button type="button" className="button secondary"
        onClick={() => void navigator.clipboard.writeText(
          `Title: ${draftTitle}\n\nDescription:\n${draftDescription}\n\nTags: ${draftTags}`
        )}>Copy reviewed draft</button>
      <p className="field-note">No publishing or metadata writes are enabled.
        Review accuracy against your video before applying changes yourself.</p>
    </div>}
  </section>;
}
