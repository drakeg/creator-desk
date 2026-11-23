import { useEffect, useState } from "react";
import type { OptimizationResult, OptimizationField, ApprovedMetadataUpdate } from "../shared/optimization";
import { appendSuggestedTag, draftFromOptimization, needsMetadataReview, optimizationAdvice, reconcileOptimizationDraft, selectedMetadata } from "../shared/optimization";
import { ownedShortsUploads } from "../shared/owned-shorts";
import type { ChannelHistory, YouTubeState } from "../shared/youtube";

type Draft = ReturnType<typeof draftFromOptimization>;
const draftOf = draftFromOptimization;

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
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<Record<string, boolean>>({});

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
            const saved = await window.desktop.getOptimizationDraft({
              videoId: result.value.videoId, channelId: result.value.channelId,
            });
            if (!active) return;
            const restored = saved.ok && saved.value
              ? reconcileOptimizationDraft(saved.value.original, result.value, saved.value.draft)
              : null;
            setVideos(current => [...current, result.value]);
            setDrafts(current => ({
              ...current, [item.id]: restored?.draft ?? draftOf(result.value),
            }));
            if (saved.ok && saved.value) {
              setSavedDrafts(current => ({ ...current, [item.id]: true }));
              if (restored?.conflict) setNotice("A saved draft conflicts with newer YouTube metadata. Review before approval.");
            } else if (!saved.ok) {
              setNotice("Saved drafts could not be read. Current YouTube metadata is shown.");
            }
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
      const previous = videos.find(item => item.videoId === videoId);
      const existingDraft = drafts[videoId];
      const reconciled = previous && existingDraft
        ? reconcileOptimizationDraft(previous, result.value, existingDraft)
        : { draft: draftOf(result.value), preserved: false, conflict: false };
      setVideos(current => current.map(item => item.videoId === videoId ? result.value : item));
      setDrafts(current => ({ ...current, [videoId]: reconciled.draft }));
      // A new remote baseline invalidates any prior field selections or approval.
      setSelectedFields(current => ({ ...current, [videoId]: [] }));
      setPendingApproval(null);
      if (reconciled.conflict) setNotice("YouTube metadata changed while your draft was edited. Your edits were preserved; compare them against the refreshed video before approving.");
      else if (reconciled.preserved) setNotice("Recommendations refreshed. Your unfinished edits were preserved; reselect any fields you want to approve.");
      else setNotice("Recommendations refreshed.");
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
  async function saveDraft(video: OptimizationResult) {
    const draft = drafts[video.videoId];
    if (!draft) return;
    try {
      const saved = await window.desktop.saveOptimizationDraft({
        videoId: video.videoId, channelId: video.channelId,
        saved: { original: video, draft },
      });
      if (!saved.ok) { setError(saved.error.message); return; }
      setSavedDrafts(current => ({ ...current, [video.videoId]: true }));
      setNotice("Draft saved locally. Publishing still requires separate approval.");
    } catch { setError("Could not save this draft."); }
  }
  async function discardSavedDraft(video: OptimizationResult) {
    try {
      const removed = await window.desktop.removeOptimizationDraft({
        videoId: video.videoId, channelId: video.channelId,
      });
      if (!removed.ok) { setError(removed.error.message); return; }
      setSavedDrafts(current => ({ ...current, [video.videoId]: false }));
      setNotice("Saved copy removed. Your current unsaved edits remain visible.");
    } catch { setError("Could not remove saved draft."); }
  }
  const reviewCount = videos.filter(needsMetadataReview).length;
  const visibleVideos = onlyNeedsReview ? videos.filter(needsMetadataReview) : videos;
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
    {!!videos.length && <section aria-label="Filter optimization recommendations">
      <label className="field-note">
        <input type="checkbox" checked={onlyNeedsReview}
          onChange={e => setOnlyNeedsReview(e.target.checked)} />
        Show only videos needing review ({reviewCount} of {videos.length} checked)
      </label>
      <p className="field-note">Based only on basic metadata checks, not a performance or ranking score. Filtering does not change drafts or approve edits.</p>
    </section>}
    {!loading && onlyNeedsReview && visibleVideos.length === 0 && count > 0 &&
      <p role="status">No loaded videos currently have basic metadata gaps. Show all videos to review everything.</p>}
    <div className="optimize-feed">
      {visibleVideos.map(video => {
        const advice = optimizationAdvice(video);
        const draft = drafts[video.videoId];
        const selected = proposals(video);
        const hasSelectedChanges = !!selected && selected.approvedFields.some(field =>
          field === "tags" ? JSON.stringify(selected.proposed.tags) !== JSON.stringify(video.tags)
            : selected.proposed[field] !== video[field]);
        const approval = pendingApproval?.original.videoId === video.videoId
          ? pendingApproval : null;
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
              <div className="optimize-tag-suggestions">
                <p><strong>Possible tags from your title:</strong> Choose only phrases that accurately describe the video. Adding one edits your local draft; it does not approve or publish it.</p>
                <div className="youtube-actions">
                  {advice.candidateTags.map(tag => <button key={tag} type="button"
                    className="button secondary" aria-label={`Add tag ${tag} to draft`}
                    disabled={!draft || !!applying || draft.tags.split(",").some(t =>
                      t.trim().toLocaleLowerCase() === tag.toLocaleLowerCase())}
                    onClick={() => {
                      if (!draft) return;
                      edit(video.videoId, "tags", appendSuggestedTag(draft.tags, tag));
                    }}>+ {tag}</button>)}
                </div>
              </div>}
            <details>
              <summary>Edit recommendations for this video</summary>
              {draft && <div className="optimize-edit-fields">
                {advice.suggestedDescriptionOpening && !draft.description.trim() &&
                  <div>
                    <p><strong>Suggested description starter:</strong> {advice.suggestedDescriptionOpening}</p>
                    <button type="button" className="button secondary"
                      onClick={() => edit(video.videoId, "description", advice.suggestedDescriptionOpening!)}>
                      Use starter in editable draft
                    </button>
                    <p className="field-note">This starter uses only your existing title. Review it against the video, replace the placeholder, and add appropriate sponsor/affiliate disclosures before approving any update.</p>
                  </div>}
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
                <div className="youtube-actions">
                  <button type="button" className="button secondary"
                    onClick={() => void saveDraft(video)}>Save draft locally</button>
                  {savedDrafts[video.videoId] && <button type="button" className="button secondary"
                    onClick={() => void discardSavedDraft(video)}>Remove saved copy</button>}
                </div>
                <button type="button" className="button secondary" onClick={() => {
                  void navigator.clipboard.writeText(
                    `Title: ${draft.title}\n\nDescription:\n${draft.description}\n\nTags: ${draft.tags}`,
                  ).then(() => setNotice("Reviewed draft copied."))
                    .catch(() => setError("Could not copy this draft."));
                }}>Copy edited draft</button>
                <fieldset className="optimize-field-selection" disabled={!!applying}>
                  <legend>Choose exactly which changes to approve</legend>
                  <p className="field-note">Nothing is selected by default. Unchecked fields are kept unchanged on YouTube.</p>
                  {([
                    ["title", "Title", draft.title.trim() !== video.title],
                    ["description", "Description", draft.description !== video.description],
                    ["tags", "Tags", JSON.stringify(
                      draft.tags.split(",").map(t => t.trim()).filter(Boolean),
                    ) !== JSON.stringify(video.tags)],
                  ] as const).map(([field, label, changed]) =>
                    <label key={field}>
                      <input type="checkbox" aria-label={`Approve ${label.toLowerCase()} change`}
                        checked={(selectedFields[video.videoId] ?? []).includes(field)}
                        disabled={!changed || !!applying}
                        onChange={e => toggleApproval(video.videoId, field, e.target.checked)}/>
                      {label} {changed ? "— include this change" : "— no change"}
                    </label>)}
                </fieldset>
                <button type="button" className="button primary"
                  disabled={!editor?.editingConnected || !!applying || !hasSelectedChanges}
                  onClick={() => review(video)}>Review selected changes</button>
                {!editor?.editingConnected && <p className="field-note">Enable editing permission above to apply approved changes. Drafts can still be copied without it.</p>}
                {approval && <section className="optimize-approval"
                  role="dialog" aria-label="Approve exact YouTube metadata changes">
                  <h4>Review selected changes to {approval.original.title}</h4>
                  <p>Video ID: {approval.original.videoId}. Only the checked fields below will be updated. All other fields stay unchanged.</p>
                  {approval.approvedFields.includes("title") && approval.proposed.title !== approval.original.title && <div>
                    <strong>Title</strong><p>Before: {approval.original.title}</p><p>After: {approval.proposed.title}</p>
                  </div>}
                  {approval.approvedFields.includes("description") && approval.proposed.description !== approval.original.description && <div>
                    <strong>Description</strong><p>Before: {approval.original.description || "(empty)"}</p>
                    <p>After: {approval.proposed.description || "(empty)"}</p>
                  </div>}
                  {approval.approvedFields.includes("tags") &&
                    JSON.stringify(approval.proposed.tags) !== JSON.stringify(approval.original.tags) && <div>
                    <strong>Tags</strong><p>Before: {approval.original.tags.join(", ") || "(none)"}</p>
                    <p>After: {approval.proposed.tags.join(", ") || "(none)"}</p>
                  </div>}
                  <p className="field-note">Creator Desk will verify the current video before submitting only these approvals. If anything changed on YouTube, the update will stop. An uncertain request will not be automatically retried.</p>
                  <div className="youtube-actions">
                    <button className="button secondary" disabled={!!applying}
                      onClick={() => setPendingApproval(null)}>Cancel</button>
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
