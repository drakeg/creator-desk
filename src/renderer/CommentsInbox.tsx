import { useEffect, useState } from "react";
import type { InboxSnapshot } from "../shared/comments";

type Filter = "new" | "unanswered" | "responded" | "unknown" | "all";

/** Channel-scoped read-only triage, deliberately distinct from posting replies. */
export function CommentsInbox() {
  const [inbox, setInbox] = useState<InboxSnapshot | null>(null);
  const [filter, setFilter] = useState<Filter>("new");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void window.desktop.getCommentsInbox()
      .then(r => {
        if (!active) return;
        if (r.ok) setInbox(r.value);
        else setError(r.error.message);
      })
      .catch(() => { if (active) setError("Your saved comments could not be opened."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const r = await window.desktop.refreshComments();
      if (r.ok) setInbox(r.value);
      else setError(r.error.message);
    } catch { setError("Comments could not be refreshed. Existing data is preserved."); }
    finally { setBusy(false); }
  }
  async function markRead(id: string) {
    setBusy(true); setError("");
    try {
      const r = await window.desktop.markCommentRead({ id });
      if (r.ok) setInbox(r.value);
      else setError(r.error.message);
    } catch { setError("Could not mark this comment reviewed."); }
    finally { setBusy(false); }
  }
  const items = inbox?.items ?? [];
  const displayed = items.filter(item => filter === "all" ||
    (filter === "new" && item.unread) ||
    (filter === "unanswered" && item.response === "unanswered") ||
    (filter === "responded" && item.response === "responded") ||
    (filter === "unknown" && item.response === "unknown"));
  const filters: { value: Filter; title: string; count: number }[] = [
    { value: "new", title: "New / updated", count: items.filter(i => i.unread).length },
    { value: "unanswered", title: "Needs response", count: items.filter(i => i.response === "unanswered").length },
    { value: "responded", title: "Responded", count: items.filter(i => i.response === "responded").length },
    { value: "unknown", title: "Review replies", count: items.filter(i => i.response === "unknown").length },
    { value: "all", title: "All", count: items.length },
  ];
  return <section className="research-content" aria-label="Channel comments inbox">
    <div className="studio-intro">
      <h2>Comments that need your attention</h2>
      <p>Review recent activity and conversations awaiting a reply, using data from your connected channel.
        This inbox never posts comments automatically.</p>
    </div>
    <div className="youtube-actions">
      <button className="button primary" type="button" disabled={busy}
        onClick={() => void refresh()}>{busy ? "Refreshing…" : "Refresh comments"}</button>
      <label htmlFor="comment-filter">Show</label>
      <select id="comment-filter" value={filter} onChange={e => setFilter(e.target.value as Filter)}>
        {filters.map(f => <option value={f.value} key={f.value}>{f.title} ({f.count})</option>)}
      </select>
    </div>
    {error && <p role="alert" className="alert">{error}</p>}
    {loading && <p role="status">Loading saved comments…</p>}
    {inbox ? <p className="field-note" role="status">
      Last refreshed {new Date(inbox.fetchedAt).toLocaleString()}.
      Showing up to 100 recent threads{inbox.complete ? "." : "; more older threads exist beyond this snapshot."}
      {" "}A reply status is unknown if YouTube returned only some replies.
    </p> : !loading && <p className="field-note">Choose Refresh comments to load a recent snapshot.
      Refresh requires your own connected and synced YouTube channel.</p>}
    {!loading && inbox && !displayed.length && <p>No comments match this filter in the current snapshot.</p>}
    <div className="research-results">
      {displayed.map(item => <article className="change-card research-result" key={item.id}>
        <div className="change-card-heading">
          <h3>{item.author || "YouTube viewer"}</h3>
          <span>{item.unread ? "New / updated" : "Reviewed"}</span>
        </div>
        <p className="field-note">Published: {new Date(item.publishedAt).toLocaleString()}
          {" · "}Last seen update: {new Date(item.updatedAt).toLocaleString()}</p>
        <p>{item.text || "(No text available)"}</p>
        <p><strong>Response:</strong> {item.response === "unanswered" ? "No channel reply in this thread" :
          item.response === "responded" ? "Channel replied" : "Unknown — review full replies"}
          {" · "}{item.replyCount} total replies</p>
        <div className="youtube-actions">
          {item.videoId && <button className="button secondary" type="button"
            onClick={() => {
              void window.desktop.openResearchVideo({ videoId: item.videoId! })
                .then(r => { if (!r.ok) setError(r.error.message); })
                .catch(() => setError("Could not open the video's source."));
            }}>Open video</button>}
          {item.unread && <button className="button secondary" type="button"
            disabled={busy} onClick={() => void markRead(item.id)}>Mark reviewed</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
