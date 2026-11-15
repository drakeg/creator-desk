import { useEffect, useState } from "react";
import type { OptimizationResult } from "../shared/optimization";
import { optimizationAdvice } from "../shared/optimization";
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
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [connection, history] = await Promise.all([
          window.desktop.getYouTube(), window.desktop.getChannelHistory(),
        ]);
        if (!active) return;
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

  async function refresh(videoId: string) {
    setRefreshing(videoId);
    setError("");
    try {
      const result = await window.desktop.optimizeVideo({ videoId });
      if (!result.ok) { setError(result.error.message); return; }
      setVideos(current => current.map(item => item.videoId === videoId ? result.value : item));
      setDrafts(current => ({ ...current, [videoId]: draftOf(result.value) }));
    } catch {
      setError("Could not refresh this video. Its existing recommendations remain visible.");
    } finally { setRefreshing(""); }
  }
  function edit(videoId: string, key: keyof Draft, value: string) {
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
                <p className="field-note">Applying approved edits directly to YouTube is the next
                  planned step. It will request write permission and confirm the exact changes.</p>
              </div>}
            </details>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
