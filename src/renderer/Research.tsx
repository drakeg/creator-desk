import { useState } from "react";
import type { ResearchResults } from "../shared/research";

/** Live public video metadata for idea research; never a source picker for Shorts. */
export function Research() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search() {
    setBusy(true); setError(""); setResults(null);
    try {
      const result = await window.desktop.researchVideos({ query });
      if (result.ok) setResults(result.value);
      else setError(result.error.message);
    } catch {
      setError("Research could not connect to YouTube. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    try {
      const result = await window.desktop.openResearchVideo({ videoId: id });
      if (!result.ok) setError(result.error.message);
    } catch {
      setError("The original video link could not open.");
    }
  }
  return (
    <section className="research-content" aria-label="Video topic research">
      <div className="studio-intro">
        <h2>Research your next video idea</h2>
        <p>Discover real videos around a topic, with publishing dates, channels and observed views.
          Explore what creators cover before writing your own original angle.</p>
      </div>
      <form className="research-search" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <label htmlFor="research-query">Search YouTube topics or keywords</label>
        <div className="youtube-actions">
          <input id="research-query" required minLength={2} maxLength={100}
            value={query} placeholder="e.g. RV solar battery upgrade"
            onChange={(e) => setQuery(e.target.value)} disabled={busy} />
          <button className="button primary" type="submit" disabled={busy || query.trim().length < 2}>
            {busy ? "Searching…" : "Research videos"}
          </button>
        </div>
      </form>
      <p className="field-note">
        Requires a connected YouTube channel. Searches are user-triggered, capped at 10 results
        and 20 searches per workspace per UTC day to limit API usage. YouTube search ranking is
        not a measure of demand; exact keyword search volume and competition scores are not
        available from this API. Public video results are for research, not Shorts creation.
      </p>
      {error && <p className="alert" role="alert">{error}</p>}
      {results && <div role="status">
        <p>Showing {results.videos.length} YouTube results for <strong>{results.query}</strong>.
          Checked {new Date(results.fetchedAt).toLocaleString()}.
          {results.queriesRemainingToday} research searches remaining today.</p>
        {!results.videos.length && <p>No matching videos were returned. Try another phrase.</p>}
      </div>}
      <div className="research-results">
        {results?.videos.map((video) => (
          <article className="change-card research-result" key={video.id}>
            <h3>{video.title}</h3>
            <p><strong>Channel:</strong> {video.channelTitle}</p>
            <p><strong>Published:</strong> {new Date(video.publishedAt).toLocaleDateString()}
              {" · "}<strong>Observed views:</strong>{" "}
              {video.views === null ? "Unavailable" : video.views.toLocaleString()}</p>
            <p className="field-note">Source: youtube.com/watch?v={video.id}.
              Counts are cumulative snapshots, not views per hour or a prediction of success.</p>
            <button type="button" className="button secondary"
              onClick={() => void open(video.id)}>Open research source on YouTube</button>
          </article>
        ))}
      </div>
    </section>
  );
}
