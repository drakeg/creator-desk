import { useEffect, useState } from "react";
import type { OptimizationResult, OptimizationField, ApprovedMetadataUpdate } from "../shared/optimization";
import { optimizationAdvice, selectedMetadata } from "../shared/optimization";
import { ownedShortsUploads } from "../shared/owned-shorts";
import type { ChannelHistory, YouTubeState } from "../shared/youtube";

type Draft = { title: string; description: string; tags: string };
const draftOf = (video: OptimizationResult): Draft => ({
  title: video.title, description: video.description, tags: video.tags.join(", "),
});

/** Owner-only, immediately loaded video recommendations; publishing requires a separate approval flow. */
export function Optimize() {
  const [videos, setVideos] = useState<OptimizationResult[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<YouTubeState | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, OptimizationField[]>>({});
  const [pendingApproval, setPendingApproval] = useState<ApprovedMetadataUpdate | null>(null);
  const [applying, setApplying] = useState("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [connection, history] = await Promise.all([
          window.desktop.getYouTube(), window.desktop.getChannelHistory(),
        ]);
        if (!active) return;
        if (connection.ok) setEditor(connection.value);
        if (!connection.ok || !history.ok) {
          setError("Your YouTube channel history could not be loaded.");
          return;
        }
        const own = ownedShortsUploads(
          connection.value as YouTubeState, history.value as ChannelHistory | null,
        ).slice(0, 8);
        setCount(own.length);
        if (!own.length) return;
        // Bounded, sequential loading avoids a burst of YouTube Data API requests.
        for (const item of own) {
          if (!active) return;
          const result = await window.desktop.optimizeVideo({ videoId: item.id });
          if (!active) return;
          if (result.ok) {
            setVideos(current => [...current, result.value]);
            setDrafts(current => ({ ...current, [item.id]: draftOf(result.value) }));
            void window.desktop.getOwnVideoThumbnail({ videoId: item.id })
              .then(photo => {
                if (active && photo.ok && photo.value)
                  setThumbnails(current => ({ ...current, [item.id]: photo.value! }));
              }).catch(() => {});
          } else {
            setNotice("Some video recommendations could not be loaded. Use Refresh to retry.");
          }
        }
      } catch {
        if (active) setError("Could not load recommendations. Your saved YouTube data is unchanged.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editor?.editingPending) return;
    let active = true;
    const timer = setInterval(() => {
      void window.desktop.getYouTube().then(result => {
        if (active && result.ok) setEditor(result.value);
      }).catch(() => {});
    }, 900);
    return () => { active = false; clearInterval(timer); };
  }, [editor?.editingPending]);

  async function grantEditing() {
    setError("");
    try {
      const result = await window.desktop.enableYouTubeEditing();
      if (result.ok) setEditor(result.value);
      else setError(result.error.message);
    } catch {
      setError("Could not start Google editing authorization.");
    }
  }
  const proposals = (video: OptimizationResult) => {
    const draft = drafts[video.videoId];
    if (!draft) return null;
    const tags = draft.tags.split(",").map(t => t.trim()).filter(Boolean);
    const fields = selectedFields[video.videoId] ?? [];
    const proposed = selectedMetadata(video, {
      title: draft.title, description: draft.description, tags,
    }, fields);
    return { proposed, approvedFields: fields };
  };
  function toggleApproval(videoId: string, field: OptimizationField, checked: boolean) {
    setSelectedFields(current => {
      const fields = current[videoId] ?? [];
      return { ...current, [videoId]: checked
        ? [...fields.filter(item => item !== field), field]
        : fields.filter(item => item !== field) };
    });
    setPendingApproval(null);
  }
  function review(video: OptimizationResult) {
    const selection = proposals(video);
    if (!selection || !selection.approvedFields.length) return;
    const { proposed, approvedFields } = selection;
    const changed = approvedFields.some(field => field === "tags"
      ? JSON.stringify(proposed.tags) !== JSON.stringify(video.tags)
      : proposed[field] !== video[field]);
    if (!changed) {
      setError("Select at least one field with an actual change.");
      return;
    }
    setError("");
    // Freeze the reviewed values; later text edits can't silently modify approval.
    setPendingApproval({
      original: video, proposed, approvedFields: [...approvedFields], approved: true,
    });
  }
  async function apply(video: OptimizationResult) {
    const approval = pendingApproval;
    if (!approval || approval.original.videoId !== video.videoId || !editor?.editingConnected) return;
    setApplying(video.videoId); setError(""); setNotice("");
    try {
      const response = await window.desktop.applyApprovedMetadata(approval);
      if (!response.ok) { setError(response.error.message); return; }
      setVideos(current => current.map(v => v.videoId === video.videoId ? response.value : v));
      setDrafts(current => ({ ...current, [video.videoId]: draftOf(response.value) }));
      setSelectedFields(current => ({ ...current, [video.videoId]: [] }));
      setNotice(`YouTube confirmed and saved the approved changes to "${response.value.title}".`);
    } catch {
      setError("Update result is uncertain. Check the video on YouTube before retrying.");
    } finally { setPendingApproval(null); setApplying(""); }
  }
  async function refresh(videoId: string) {
    setRefreshing(videoId);
    setError("");
    try {
      const result = await window.desktop.optimizeVideo({ videoId });
      if (!result.ok) { setError(result.error.message); return; }
      setVideos(current => current.map(item => item.videoId === videoId ? result.value : item));
      setDrafts(current => ({ ...current, [videoId]: draftOf(result.value) }));
      setSelectedFields(current => ({ ...current, [videoId]: [] }));
      setPendingApproval(null);
    } catch {
      setError("Could not refresh this video. Its existing recommendations remain visible.");
    } finally { setRefreshing(""); }
  }
  function edit(videoId: string, key: keyof Draft, value: string) {
    setPendingApproval(null);
    setDrafts(current => ({
      ...current, [videoId]: { ...current[videoId]!, [key]: value },
    }));
  }
  return <section className="research-content" aria-label="Video optimization recommendations">
    <div className="studio-intro">
      <h2>Recommendations for your channel</h2>
      <p>Creator Desk reviews your latest synced uploads automatically. Video thumbnails appear beside
        practical recommendations; expand any video to refine a draft. No changes are sent to YouTube
        without a separate approval and write-permission workflow.</p>
    </div>
    <section className="optimize-editor-permission" aria-label="YouTube editing permissions">
      {editor?.editingConnected ? <p role="status">Editing permission connected. Changes still require your explicit approval.</p> :
        <div>
          <p><strong>Apply approved changes directly to YouTube.</strong> Viewing recommendations does not require editing access.</p>
          <p className="field-note">Google's YouTube editing permission is broad: it can also authorize deleting content and modifying comments. Creator Desk will only use it for a change you explicitly approve.</p>
          <button type="button" className="button secondary"
            disabled={!editor?.connected || editor?.editingPending}
            onClick={() => void grantEditing()}>
            {editor?.editingPending ? "Authorizing with Google…" : "Enable approved YouTube updates"}
          </button>
          {editor?.editingError && <p className="alert" role="alert">{editor.editingError}</p>}
        </div>}
    </section>
    {loading && <p role="status">Checking your own videos and preparing recommendations…</p>}
    {!loading && !count && <p className="field-note">Connect your YouTube channel and sync uploads in Dashboard
      to receive automatic recommendations. Public and competitor videos are excluded.</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="optimize-feed">
      {videos.map(video => {
        const advice = optimizationAdvice(video);
        const draft = drafts[video.videoId];
        return <article className="optimize-feed-card" key={video.videoId}>
          <div className="optimize-feed-media">
            {thumbnails[video.videoId] ?
              <img src={thumbnails[video.videoId]} alt={`Thumbnail for ${video.title}`} /> :
              <div className="optimize-thumbnail-placeholder" role="img" aria-label="Thumbnail unavailable">
                Thumbnail unavailable
              </div>}
            <p className="field-note">Your video · {video.videoId}</p>
            <button className="button secondary" type="button"
              disabled={refreshing === video.videoId}
              onClick={() => void refresh(video.videoId)}>
              {refreshing === video.videoId ? "Refreshing…" : "Refresh recommendations"}
            </button>
          </div>
          <div className="optimize-feed-advice">
            <h3>{video.title}</h3>
            <p className="field-note">Checked {new Date(video.fetchedAt).toLocaleString()}.
              Suggestions are content checks, not guaranteed growth.</p>
            <ul>{advice.tips.map((tip, i) => <li key={i}>
              <strong>{tip.label}</strong> ({tip.field}): {tip.reason}
            </li>)}</ul>
            {!!advice.candidateTags.length &&
              <p><strong>Possible tags:</strong> {advice.candidateTags.join(", ")}.
                Use only accurate phrases.</p>}
            <details>
              <summary>Edit recommendations for this video</summary>
              {draft && <div className="optimize-edit-fields">
                <label>Proposed title
                  <textarea rows={2} maxLength={100} value={draft.title}
                    onChange={e => edit(video.videoId, "title", e.target.value)}/>
                </label>
                <label>Proposed description
                  <textarea rows={5} maxLength={5000} value={draft.description}
                    onChange={e => edit(video.videoId, "description", e.target.value)}/>
                </label>
                <label>Proposed tags (comma-separated)
                  <textarea rows={3} value={draft.tags}
                    onChange={e => edit(video.videoId, "tags", e.target.value)}/>
                </label>
                <button type="button" className="button secondary" onClick={() => {
                  void navigator.clipboard.writeText(
                    `Title: ${draft.title}\n\nDescription:\n${draft.description}\n\nTags: ${draft.tags}`,
                  ).then(() => setNotice("Reviewed draft copied."))
                    .catch(() => setError("Could not copy this draft."));
                }}>Copy edited draft</button>
                <button type="button" className="button primary"
                  disabled={!editor?.editingConnected || !!applying || !proposals(video.videoId) ||
                    (draft.title.trim() === video.title && draft.description === video.description &&
                      draft.tags === video.tags.join(", "))}
                  onClick={() => setConfirmId(video.videoId)}>Review changes to apply</button>
                {!editor?.editingConnected && <p className="field-note">Enable editing permission above to apply approved changes. Drafts can still be copied without it.</p>}
                {confirmId === video.videoId && <section className="optimize-approval"
                  role="dialog" aria-label="Approve exact YouTube metadata changes">
                  <h4>Approve edits to {video.title}</h4>
                  <p>Video ID: {video.videoId}. Only the fields shown below will change.</p>
                  {draft.title.trim() !== video.title && <div>
                    <strong>Title</strong><p>Before: {video.title}</p><p>After: {draft.title.trim()}</p>
                  </div>}
                  {draft.description !== video.description && <div>
                    <strong>Description</strong><p>Before: {video.description || "(empty)"}</p>
                    <p>After: {draft.description || "(empty)"}</p>
                  </div>}
                  {draft.tags !== video.tags.join(", ") && <div>
                    <strong>Tags</strong><p>Before: {video.tags.join(", ") || "(none)"}</p>
                    <p>After: {draft.tags || "(none)"}</p>
                  </div>}
                  <p className="field-note">Creator Desk will re-fetch the current video first. If its metadata changed, the update will stop. An uncertain request will not be automatically retried.</p>
                  <div className="youtube-actions">
                    <button className="button secondary" disabled={!!applying}
                      onClick={() => setConfirmId("")}>Cancel</button>
                    <button className="button primary" disabled={!!applying}
                      onClick={() => void apply(video)}>
                      {applying ? "Verifying YouTube changes…" : "Confirm and update this YouTube video"}
                    </button>
                  </div>
                </section>}
              </div>}
            </details>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
