import { useEffect, useState } from "react";
import type { ChannelHistory, YouTubeState } from "../shared/youtube";
import type { RetentionCacheRecord } from "../main/youtube/retention-cache";
import type { RetentionQuery } from "../shared/retention";
import { retentionTime } from "../shared/retention-time";
import { retentionPreset } from "../shared/retention-range";

interface Props {
  history: ChannelHistory | null;
  connection: YouTubeState | null;
  initialVideoId: string;
  back: () => void;
  openSettings: () => void;
}

export function Retention({ history, connection, initialVideoId, back, openSettings }: Props) {
  const channelId = connection?.snapshot?.id ?? history?.channelId ?? "";
  const videos = history?.uploads?.rows ?? [];
  const [videoId, setVideoId] = useState(initialVideoId || videos[0]?.id || "");
  const [startDate, setStartDate] = useState(history?.startDate ?? "");
  const [endDate, setEndDate] = useState(history?.endDate ?? "");
  const [record, setRecord] = useState<RetentionCacheRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const selected = videos.find((v) => v.id === videoId);
  const duration = selected?.durationSeconds;
  const halfway = retentionTime(duration, 0.5);
  const fullTime = retentionTime(duration, 1);
  const valid = !!channelId && !!videoId && !!startDate && !!endDate &&
    startDate <= endDate && endDate <= new Date().toISOString().slice(0, 10);
  const query: RetentionQuery | null = valid
    ? { channelId, videoId, startDate, endDate } : null;

  useEffect(() => {
    let active = true;
    setRecord(null);
    setError("");
    setLoading(true);
    // Build the lookup from stable primitive dependencies inside the effect.
    const cachedQuery: RetentionQuery | null = valid
      ? { channelId, videoId, startDate, endDate }
      : null;
    if (!cachedQuery) {
      setLoading(false);
      return () => { active = false; };
    }
    void window.desktop.getRetention(cachedQuery).then((result) => {
      if (!active) return;
      if (result.ok) setRecord(result.value);
      else setError(result.error.message);
    }).catch(() => {
      if (active) setError("Saved retention could not be opened.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [valid, channelId, videoId, startDate, endDate]);

  async function refresh() {
    if (!query) return;
    setRefreshing(true);
    setError("");
    try {
      const result = await window.desktop.syncRetention(query);
      if (result.ok) {
        // Inputs are locked during refresh; channel switches unmount this view.
        if (result.value.query.channelId === channelId &&
            result.value.query.videoId === videoId &&
            result.value.query.startDate === startDate &&
            result.value.query.endDate === endDate) setRecord(result.value);
      } else setError(result.error.message);
    } catch {
      setError("Retention could not refresh. Saved history is unchanged.");
    } finally {
      setRefreshing(false);
    }
  }
  const points = record?.points ?? [];
  const maxY = Math.max(1, ...points.map((p) => p.audienceWatchRatio));
  const x = (n: number) => 50 + n * 800;
  const y = (n: number) => 230 - n / maxY * 195;
  const line = points.map((p, i) =>
    `${i ? "L" : "M"} ${x(p.elapsedVideoTimeRatio).toFixed(2)} ${y(p.audienceWatchRatio).toFixed(2)}`,
  ).join(" ");
  return (
    <section className="retention-content" aria-label="Audience retention analytics">
      <button className="text-button" onClick={back}>Back to channel analytics</button>
      <h2>Audience retention</h2>
      <p className="field-note">
        Inspect the share of viewing activity at each point in one video.
        Replays may show more than 100% watch ratio; a decline alone does not establish why viewers left.
      </p>
      {history && (
        <div className="retention-presets" role="group" aria-label="Retention date shortcuts">
          {([28, 90, "all"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              className="button secondary"
              disabled={refreshing}
              onClick={() => {
                const range = retentionPreset(history.startDate, history.endDate, preset);
                if (!range) return;
                setStartDate(range.startDate);
                setEndDate(range.endDate);
              }}
            >
              {preset === "all" ? "All available history" : `Last ${preset} days`}
            </button>
          ))}
        </div>
      )}
      <div className="daily-filters">
        <label htmlFor="retention-video">Video</label>
        <select id="retention-video" value={videoId} disabled={refreshing} onChange={(e) => setVideoId(e.target.value)}>
          {!videos.length && <option value="">No synced videos</option>}
          {videos.map((video) => <option key={video.id} value={video.id}>{video.title}</option>)}
        </select>
        <label htmlFor="retention-start">From</label>
        <input id="retention-start" type="date" value={startDate} disabled={refreshing} onChange={(e) => setStartDate(e.target.value)} />
        <label htmlFor="retention-end">To</label>
        <input id="retention-end" type="date" value={endDate} disabled={refreshing} onChange={(e) => setEndDate(e.target.value)} />
        <button className="button primary" disabled={!valid || !connection?.connected || refreshing}
          onClick={() => void refresh()}>
          {refreshing ? "Refreshing…" : "Refresh retention"}
        </button>
        {refreshing && <button className="button secondary" onClick={() => {
          void window.desktop.cancelRetention().then((result) => {
            if (!result.ok) setError(result.error.message);
          });
        }}>Stop refresh</button>}
      </div>
      {!valid && <p role="status">Choose a video and a valid date range ending today or earlier.</p>}
      {!connection?.connected && <p role="status">Saved curves remain available offline. <button className="text-button" onClick={openSettings}>Connect YouTube</button> to refresh.</p>}
      {error && <p role="alert" className="alert">{error}</p>}
      {loading && <p role="status">Opening saved retention…</p>}
      {!loading && !record && valid && <p role="status">No retention curve has been saved for this video and period. Refresh to request one.</p>}
      {record && <p className="field-note">Saved {new Date(record.fetchedAt).toLocaleString()} · {record.query.startDate} through {record.query.endDate}. Cached locally for offline use.</p>}
      {record && !points.length && <p role="status">YouTube returned no retention rows for this period. This is unavailable data, not zero retention.</p>}
      {points.length > 0 && <>
        <div className="report-chart" role="img" aria-label={`Audience watch ratio curve for ${selected?.title ?? videoId}, from ${startDate} to ${endDate}`}>
          <svg viewBox="0 0 900 275" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <line x1="50" y1="230" x2="850" y2="230" className="chart-axis" />
            <line x1="50" y1="35" x2="50" y2="230" className="chart-axis" />
            <line x1="50" y1={y(1)} x2="850" y2={y(1)} className="chart-grid" />
            <path d={line} className="chart-line" />
            <text x="5" y={y(maxY) + 5} fill="currentColor" fontSize="12">{Math.round(maxY * 100)}%</text>
            <text x="7" y={y(1) + 5} fill="currentColor" fontSize="12">100%</text>
            <text x="20" y="234" fill="currentColor" fontSize="12">0%</text>
            <text x="50" y="255" fill="currentColor" fontSize="12">Start</text>
            <text x="450" y="255" textAnchor="middle" fill="currentColor" fontSize="12">{halfway ?? "50%"}</text>
            <text x="850" y="255" textAnchor="end" fill="currentColor" fontSize="12">{fullTime ?? "End"}</text>
          </svg>
        </div>
        <p className="field-note">Horizontal position: {fullTime ? "elapsed video time" : "percentage of video elapsed (duration unavailable)"}. Vertical axis: audience watch ratio. Replays can exceed 100%.</p>
        <div className="table-scroll">
          <table className="analytics-table">
            <thead><tr><th scope="col">Video progress</th>{fullTime && <th scope="col">Elapsed time</th>}<th scope="col">Watch ratio</th><th scope="col">Relative retention</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.elapsedVideoTimeRatio}>
              <td>{(point.elapsedVideoTimeRatio * 100).toFixed(1)}%</td>
              {fullTime && <td>{retentionTime(duration, point.elapsedVideoTimeRatio)}</td>}
              <td>{(point.audienceWatchRatio * 100).toFixed(1)}%</td>
              <td>{(point.relativeRetentionPerformance * 100).toFixed(1)}%</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>
  );
}
