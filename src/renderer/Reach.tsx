import { useEffect, useRef, useState } from "react";
import type { ReachOverview, ReachQuery } from "../shared/reach";
import type { YouTubeState } from "../shared/youtube";
import { googleSetupPages } from "../shared/google-setup";
const number = (value: number | null, digits = 0) =>
  value === null
    ? "Unavailable"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
export function Reach({
  connection,
  openSettings,
}: {
  connection: YouTubeState | null;
  openSettings: () => void;
}) {
  const [data, setData] = useState<ReachOverview | null>(null),
    [query, setQuery] = useState<ReachQuery>({});
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const mounted = useRef(true);
  const queryRef = useRef(query);
  queryRef.current = query;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void window.desktop
      .getReach(query)
      .then((result) => {
        if (!active) return;
        if (result.ok) setData(result.value);
        else setError(result.error.message);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Reach data could not be opened. Try refreshing this view.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query]);
  useEffect(() => {
    if (!data?.busy || busy) return;
    let active = true;
    const timer = setInterval(() => {
      void window.desktop
        .getReach(query)
        .then((result) => {
          if (active && mounted.current && result.ok) setData(result.value);
        })
        .catch(() => {});
    }, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [data?.busy, busy, query]);
  async function refresh() {
    setBusy(true);
    setError("");
    setNotice("Checking YouTube reach reports…");
    try {
      const result = await window.desktop.syncReach();
      if (!mounted.current) return;
      if (result.ok) {
        setNotice(
          result.value.coveredDays.length
            ? "Reach history updated and saved locally."
            : "Reporting is set up. YouTube has not supplied the first reports yet. Refresh later.",
        );
      } else {
        setError(result.error.message);
        setNotice("");
      }
      const selected = queryRef.current;
      const fresh = await window.desktop.getReach(selected);
      if (mounted.current && fresh.ok && selected === queryRef.current)
        setData(fresh.value);
    } catch {
      if (mounted.current) {
        setError(
          "Reach could not refresh. Your saved data is unchanged. Try again.",
        );
        setNotice("");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const working = busy || !!data?.busy;
  const update = (patch: Partial<ReachQuery>) => {
    setError("");
    setQuery((current) => {
      const next = { ...current, ...patch, page: patch.page ?? 1 };
      const start = next.startDate ?? data?.firstDay,
        end = next.endDate ?? data?.lastDay;
      if (start && end && start > end) {
        if ("startDate" in patch) next.endDate = start;
        else if ("endDate" in patch) next.startDate = end;
      }
      return next;
    });
  };
  async function openReporting() {
    try {
      const result = await window.desktop.openGoogleSetup({
        page: "reportingApi",
      });
      if (!result.ok) setError(result.error.message);
    } catch {
      setError("The browser could not open. Copy the setup URL instead.");
    }
  }
  return (
    <section
      className="reach-content"
      aria-label="Reach analytics"
      aria-busy={working || loading}
    >
      <div className="setting-row">
        <div>
          <h2>Impressions &amp; click-through rate</h2>
          <p>
            Understand how often your thumbnails appear and how often viewers
            click.
          </p>
        </div>
        <div className="youtube-actions">
          {connection?.connected ? (
            <button
              className="button primary"
              disabled={working || loading}
              onClick={() => void refresh()}
            >
              {working
                ? "Refreshing reach…"
                : data?.enabled
                  ? "Refresh reach"
                  : "Enable reach reporting"}
            </button>
          ) : (
            <button className="button primary" onClick={openSettings}>
              Connect YouTube
            </button>
          )}
          {working && (
            <button
              className="button secondary"
              onClick={() => {
                void window.desktop
                  .cancelReach()
                  .then((result) => {
                    if (!result.ok) setError(result.error.message);
                  })
                  .catch(() => setError("Reach refresh could not be stopped."));
              }}
            >
              Stop reach refresh
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {(notice || working) && (
        <p className="field-note" role="status">
          {notice || "A reach refresh is in progress for this channel."}
        </p>
      )}
      {loading && <p role="status">Opening reach history…</p>}
      {!data?.enabled && !data?.coveredDays.length && !loading && (
        <div className="reach-setup">
          <h3>Set up reach once for this channel</h3>
          <p>
            Enable YouTube Reporting API in the same Google project you used to
            connect. Then choose Enable reach reporting. This asks YouTube to
            generate daily reports; it does not change your videos.
          </p>
          <a
            href={googleSetupPages.reportingApi.url}
            onClick={(event) => {
              event.preventDefault();
              void openReporting();
            }}
          >
            Enable YouTube Reporting API
          </a>
          <code className="setup-url">{googleSetupPages.reportingApi.url}</code>
        </div>
      )}
      <p className="field-note">
        New jobs generally provide the previous 30 days, then build history from
        that point. First reports can take a day or two. Reach is not an
        all-time Studio export. Downloaded history stays on this device and in
        database backups.
      </p>
      {data?.enabled && !data.coveredDays.length && (
        <p className="reach-empty" role="status">
          Waiting for YouTube reports. Setup is complete, but no report data is
          available yet. Refresh later; repeated setup is unnecessary.
        </p>
      )}
      {data?.coveredDays.length ? (
        <>
          <div className="daily-filters">
            <label htmlFor="reach-start">From</label>
            <input
              id="reach-start"
              type="date"
              value={query.startDate ?? data.firstDay ?? ""}
              max={query.endDate ?? data.lastDay ?? undefined}
              onChange={(event) =>
                update({ startDate: event.target.value || undefined })
              }
            />
            <label htmlFor="reach-end">To</label>
            <input
              id="reach-end"
              type="date"
              value={query.endDate ?? data.lastDay ?? ""}
              min={query.startDate ?? data.firstDay ?? undefined}
              onChange={(event) =>
                update({ endDate: event.target.value || undefined })
              }
            />
            <label htmlFor="reach-video">Video</label>
            <select
              id="reach-video"
              value={query.videoId ?? ""}
              onChange={(event) =>
                update({ videoId: event.target.value || undefined })
              }
            >
              <option value="">All videos</option>
              {data.videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setQuery({});
              }}
            >
              Reset reach filters
            </button>
          </div>
          <p className="field-note">
            Available reports: {data.firstDay} — {data.lastDay} ·{" "}
            {data.coveredDays.length.toLocaleString()} downloaded days ·{" "}
            {data.selectedDays.toLocaleString()} in this range. Missing days are
            unavailable. Dates use Pacific time.
          </p>
          <div className="metric-grid">
            <div className="metric">
              <span>Thumbnail impressions</span>
              <strong>{number(data.impressions)}</strong>
            </div>
            <div className="metric">
              <span>Thumbnail CTR</span>
              <strong>
                {data.ctr === null ? "Unavailable" : `${number(data.ctr, 2)}%`}
              </strong>
            </div>
          </div>
          {!data.selectedDays && (
            <p>
              No downloaded reports cover this date range. Choose another range
              or refresh.
            </p>
          )}
          {!!data.selectedDays && !data.rows.length && (
            <p>
              The downloaded reports contain no rows for this selection. No
              missing metrics have been replaced with zero.
            </p>
          )}
          <div className="reach-tables">
            <section>
              <h3>Daily reach</h3>
              <div className="table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Impressions</th>
                      <th scope="col">CTR (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((day) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td>{number(day.impressions)}</td>
                        <td>{number(day.ctr, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h3>Video reach</h3>
              <div className="table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th scope="col">Video</th>
                      <th scope="col">Impressions</th>
                      <th scope="col">CTR (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((video) => (
                      <tr key={video.id}>
                        <td>
                          <strong>{video.title}</strong>
                          {video.title !== video.id && (
                            <span className="video-id">
                              {video.id === "unassigned"
                                ? "No video identity supplied"
                                : video.id}
                            </span>
                          )}
                        </td>
                        <td>{number(video.impressions)}</td>
                        <td>{number(video.ctr, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>
                  Page {data.page} of {data.pageCount}
                </span>
                <div>
                  <button
                    className="button secondary"
                    disabled={data.page <= 1}
                    onClick={() => update({ page: data.page - 1 })}
                  >
                    Previous reach videos
                  </button>
                  <button
                    className="button secondary"
                    disabled={data.page >= data.pageCount}
                    onClick={() => update({ page: data.page + 1 })}
                  >
                    Next reach videos
                  </button>
                </div>
              </div>
            </section>
          </div>
          <details className="report-warnings">
            <summary>Which reporting days are available?</summary>
            <p>{data.coveredDays.join(", ")}</p>
          </details>
        </>
      ) : null}
      <p className="field-note">
        Last successful check:{" "}
        {data?.checkedAt
          ? new Date(data.checkedAt).toLocaleString()
          : "Not checked yet"}
        . CTR uses Google's reported percentages, weighted by impressions. It is
        unavailable if a positive-impression row lacks CTR, or if there are no
        impressions. Rounded source values may differ slightly from Studio.
      </p>
      <p className="field-note">
        Older Studio imports remain under Saved reports &amp; imports. They are
        kept separate so overlapping dates are not counted twice.
      </p>
    </section>
  );
}
