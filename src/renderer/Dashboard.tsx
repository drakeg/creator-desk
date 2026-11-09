import { useEffect, useRef, useState } from "react";
import type { ChannelHistory, YouTubeState } from "../shared/youtube";
import { ReportLibrary } from "./ReportLibrary";
import { ReportChart } from "./ReportChart";
const number = (n: number | null, digits = 0) =>
  n === null
    ? "Unavailable"
    : n.toLocaleString(undefined, { maximumFractionDigits: digits });
export function Dashboard({ openSettings }: { openSettings: () => void }) {
  const [connection, setConnection] = useState<YouTubeState | null>(null);
  const [history, setHistory] = useState<ChannelHistory | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"channel" | "reports">("channel");
  const [preset, setPreset] = useState("all");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const attempted = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void Promise.all([
      window.desktop.getYouTube(),
      window.desktop.getChannelHistory(),
    ])
      .then(([state, cache]) => {
        if (!mounted.current) return;
        if (state.ok) setConnection(state.value);
        else setError(state.error.message);
        if (cache.ok) setHistory(cache.value);
        else setError(cache.error.message);
        setLoaded(true);
      })
      .catch(() => {
        if (mounted.current) {
          setError(
            "Channel data could not be opened. Reopen this channel to try again.",
          );
          setLoaded(true);
        }
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  async function sync() {
    setSyncing(true);
    setError("");
    setMessage("Starting channel history sync…");
    try {
      const result = await window.desktop.syncChannelHistory();
      if (!mounted.current) return;
      if (result.ok) {
        setHistory(result.value);
        setMessage("Channel history updated and saved locally.");
      } else setError(result.error.message);
      const fresh = await window.desktop.getYouTube();
      if (mounted.current && fresh.ok) setConnection(fresh.value);
    } catch {
      if (mounted.current)
        setError(
          "Sync could not finish. Your previous history is preserved. Try again.",
        );
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }
  useEffect(() => {
    if (
      loaded &&
      connection?.connected &&
      (!history ||
        !connection.snapshot ||
        connection.snapshot.id !== history.channelId) &&
      !connection.sync &&
      !attempted.current &&
      !error
    ) {
      attempted.current = true;
      void sync();
    }
    // Initial backfill runs once per visit, never as an automatic failure retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, connection?.connected]);
  useEffect(() => {
    if (!syncing && !connection?.sync) return;
    let active = true;
    const timer = setInterval(() => {
      void window.desktop
        .getYouTube()
        .then((result) => {
          if (!active || !result.ok) return;
          if (connection?.sync && !result.value.sync) {
            void window.desktop
              .getChannelHistory()
              .then((cache) => {
                if (active && cache.ok) setHistory(cache.value);
              })
              .catch(() => {});
          }
          setConnection(result.value);
          if (result.value.sync) setMessage(result.value.sync.message);
        })
        .catch(() => {});
    }, 750);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [syncing, connection?.sync]);
  const busy = syncing || !!connection?.sync;
  const last = history?.endDate ?? new Date().toISOString().slice(0, 10);
  const start =
    preset === "custom"
      ? startDate
      : preset === "all"
        ? (history?.startDate ?? "")
        : new Date(Date.parse(last) - (Number(preset) - 1) * 86400000)
            .toISOString()
            .slice(0, 10);
  const end = preset === "custom" ? endDate : last;
  const invalidRange = !start || !end || start > end;
  const rows = invalidRange
    ? []
    : (history?.daily?.rows.filter((r) => r.date! >= start && r.date! <= end) ??
      []);
  const sum = (key: "views" | "watchHours" | "subscribers") =>
    rows.length && rows.every((r) => r[key] !== null)
      ? rows.reduce((n, r) => n + r[key]!, 0)
      : null;
  const videos = (history?.uploads?.rows ?? [])
    .filter((r) =>
      `${r.title} ${r.id}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => b.views - a.views);
  const snapshot = connection?.snapshot;
  return (
    <div className="channel-dashboard">
      <div className="channel-tabs" role="group" aria-label="Analytics source">
        <button
          className={`button ${tab === "channel" ? "primary" : "secondary"}`}
          aria-pressed={tab === "channel"}
          onClick={() => setTab("channel")}
        >
          Connected channel
        </button>
        <button
          className={`button ${tab === "reports" ? "primary" : "secondary"}`}
          aria-pressed={tab === "reports"}
          onClick={() => setTab("reports")}
        >
          Saved reports &amp; imports
        </button>
      </div>
      {tab === "reports" ? (
        <>
          <p className="field-note">
            Optional exports and older snapshots. These are separate from your
            connected channel history.
          </p>
          <ReportLibrary />
        </>
      ) : (
        <>
          <section className="channel-sync" aria-label="Channel history">
            <div className="setting-row">
              <div>
                <h2>{snapshot?.title ?? "Connect your YouTube channel"}</h2>
                <p>
                  {connection?.connected
                    ? "YouTube connected · read-only access"
                    : history
                      ? "Saved history available offline"
                      : "Connect once to bring your channel analytics into Creator Desk."}
                </p>
              </div>
              <div className="youtube-actions">
                {connection?.connected ? (
                  <button
                    className="button primary"
                    disabled={busy || !loaded}
                    onClick={() => void sync()}
                  >
                    {busy ? "Syncing history…" : "Sync channel history"}
                  </button>
                ) : (
                  <button className="button primary" onClick={openSettings}>
                    Connect YouTube
                  </button>
                )}
                {busy && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      void window.desktop
                        .cancelChannelSync()
                        .then((result) => {
                          if (!result.ok) setError(result.error.message);
                        })
                        .catch(() =>
                          setError("Sync could not be stopped. Try again."),
                        );
                    }}
                  >
                    Stop sync
                  </button>
                )}
              </div>
            </div>
            {(busy || message) && (
              <p role="status">{connection?.sync?.message ?? message}</p>
            )}
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            {!loaded && <p role="status">Opening channel…</p>}
            {history ? (
              <p className="field-note">
                Last history sync: {new Date(history.syncedAt).toLocaleString()}
                . Requested {history.startDate} through {history.endDate}. Saved
                locally for offline use.
              </p>
            ) : (
              <p className="field-note">
                The first sync reads daily history and your full uploads list.
                No CSV is needed for views, watch time, and subscriber changes.
                Larger channels can take a few minutes.
              </p>
            )}{" "}
            {!history && snapshot && (
              <p className="channel-totals">
                Current channel totals:{" "}
                <strong>{number(snapshot.views)}</strong> views ·{" "}
                <strong>{number(snapshot.subscribers)}</strong> subscribers ·{" "}
                <strong>{number(snapshot.videos)}</strong> videos. Subscriber
                counts may be rounded.
              </p>
            )}{" "}
          </section>
          {history && (
            <>
              <section aria-label="Daily channel analytics">
                <div className="library-header">
                  <h2>Channel performance</h2>
                  <label>
                    Dates{" "}
                    <select
                      aria-label="Analytics date range"
                      value={preset}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPreset(value);
                        if (value === "custom") {
                          setStart(history.startDate);
                          setEnd(history.endDate);
                        }
                      }}
                    >
                      <option value="all">All available history</option>
                      <option value="28">Last 28 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="365">Last 365 days</option>
                      <option value="custom">Custom dates</option>
                    </select>
                  </label>
                </div>
                {preset === "custom" && (
                  <div className="daily-filters">
                    <label htmlFor="history-start">From</label>
                    <input
                      id="history-start"
                      type="date"
                      value={startDate}
                      max={endDate}
                      onChange={(e) => setStart(e.target.value)}
                    />
                    <label htmlFor="history-end">To</label>
                    <input
                      id="history-end"
                      type="date"
                      value={endDate}
                      min={startDate}
                      max={history.endDate}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </div>
                )}
                {invalidRange && (
                  <p role="alert">
                    Choose a start and end date in chronological order.
                  </p>
                )}
                <p className="field-note">
                  {start} — {end} · {rows.length.toLocaleString()} reported
                  days. Missing days are unavailable; recent metrics may be
                  delayed. Dates follow YouTube’s reporting time zone.
                </p>
                <div className="metric-grid">
                  {[
                    ["Views", sum("views")],
                    ["Watch time (hours)", sum("watchHours")],
                    ["Subscriber change", sum("subscribers")],
                  ].map(([label, value]) => (
                    <div className="metric" key={String(label)}>
                      <span>{label}</span>
                      <strong>{number(value as number | null, 1)}</strong>
                    </div>
                  ))}
                </div>
                <ReportChart
                  daily
                  points={rows.map((r) => ({ date: r.date!, views: r.views }))}
                />
              </section>
              <section
                className="report-library"
                aria-label="Channel video library"
              >
                <div className="library-header">
                  <div>
                    <h2>Your videos</h2>
                    <p>
                      {videos.length.toLocaleString()} matching videos · highest
                      cumulative views first
                    </p>
                  </div>
                  <input
                    type="search"
                    aria-label="Search channel videos"
                    placeholder="Search videos…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <p className="field-note">
                  Cumulative video views at sync, independent of the date filter
                  above. Unavailable or deleted uploads may be omitted by
                  YouTube.
                </p>
                <div className="table-scroll">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th scope="col">Video</th>
                        <th scope="col">Cumulative views</th>
                        <th scope="col">Published</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.slice((page - 1) * 25, page * 25).map((video) => (
                        <tr key={video.id}>
                          <td>
                            <strong>{video.title}</strong>
                            <span className="video-id">{video.id}</span>
                          </td>
                          <td>{number(video.views)}</td>
                          <td>{video.published ?? "Unavailable"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!videos.length && (
                  <p>No videos returned or matching this search.</p>
                )}
                <div className="table-footer">
                  <span>
                    Page {page} of {Math.max(1, Math.ceil(videos.length / 25))}
                  </span>
                  <div>
                    <button
                      className="button secondary"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous videos
                    </button>
                    <button
                      className="button secondary"
                      disabled={page * 25 >= videos.length}
                      onClick={() => setPage(page + 1)}
                    >
                      Next videos
                    </button>
                  </div>
                </div>
              </section>
              <details className="report-warnings">
                <summary>Data coverage and optional imports</summary>
                <p>
                  This view contains daily views, watch time, subscriber
                  changes, and the available upload library. It does not yet
                  retrieve every YouTube Studio report. Impressions, CTR,
                  retention, revenue, audience and traffic-source breakdowns are
                  not included in this sync. CSV imports can supplement
                  supported fields in Saved reports &amp; imports.
                </p>
                {snapshot && (
                  <p className="channel-totals">
                    Current channel totals:{" "}
                    <strong>{number(snapshot.views)}</strong> views ·{" "}
                    <strong>{number(snapshot.subscribers)}</strong> subscribers
                    · <strong>{number(snapshot.videos)}</strong> videos.
                    Subscriber counts may be rounded.
                  </p>
                )}{" "}
                {[
                  ...(history.daily?.warnings ?? []),
                  ...(history.uploads?.warnings ?? []),
                ].map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
