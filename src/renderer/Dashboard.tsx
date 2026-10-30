import { YouTubeConnection } from "./YouTubeConnection";
import { useEffect, useState } from "react";
import { FileUp, HardDrive, Info, BarChart3 } from "lucide-react";
import type {
  Dashboard as ReportData,
  DashboardInput,
  ImportPreview,
  CommitImportInput,
} from "../shared/analytics";
import { ImportDialog } from "./ImportDialog";
import { ReportChart } from "./ReportChart";
import { ReportTable } from "./ReportTable";
const initial: DashboardInput = {
  search: "",
  sort: "views",
  direction: "desc",
  page: 1,
};
const number = (n: number | null, digits = 0) =>
  n === null
    ? "—"
    : n.toLocaleString(undefined, { maximumFractionDigits: digits });
export function Dashboard() {
  const [data, setData] = useState<ReportData | null>(null);
  const [query, setQuery] = useState<DashboardInput>(initial);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(
      () => {
        void window.desktop
          .getDashboard(query)
          .then((result) => {
            if (!active) return;
            if (result.ok) setData(result.value);
            else setError(result.error.message);
            setLoading(false);
          })
          .catch(() => {
            if (active) {
              setError(
                "The saved report could not be loaded. Try selecting it again.",
              );
              setLoading(false);
            }
          });
      },
      query.search ? 200 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  async function inspect() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktop.inspectImport();
      if (result.ok) setPreview(result.value);
      else setError(result.error.message);
    } catch {
      setError("The file could not be opened. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      const result = await window.desktop.cancelImport();
      if (result.ok) {
        setPreview(null);
        setError("");
      } else setError(result.error.message);
    } catch {
      setError("The import preview could not be cancelled. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function commit(input: CommitImportInput) {
    setBusy(true);
    setError("");
    try {
      const result = await window.desktop.commitImport(input);
      if (result.ok) {
        setPreview(null);
        setQuery({ ...initial, reportId: result.value.reportId });
        setNotice(
          result.value.duplicate
            ? "This report is already imported. Showing the existing snapshot."
            : "Report imported and saved on this Mac.",
        );
      } else setError(result.error.message);
    } catch {
      setError(
        "The report could not be saved. Your existing reports are unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const update = (patch: Partial<DashboardInput>) => {
    setError("");
    setQuery((q) => {
      const next = { ...q, ...patch };
      if (data?.selected?.kind === "daily") {
        const start = next.startDate ?? data.selected.periodStart;
        const end = next.endDate ?? data.selected.periodEnd;
        if (start && end && start > end) {
          if ("startDate" in patch) next.endDate = start;
          else if ("endDate" in patch) next.startDate = end;
        }
      }
      return next;
    });
  };
  return (
    <div className="dashboard-content" aria-busy={loading || busy}>
      <YouTubeConnection
        onReport={(reportId) => {
          setQuery({ ...initial, reportId });
          setNotice("Showing a saved YouTube snapshot.");
        }}
      />
      <div className="dashboard-toolbar">
        <span className="local-report-label">
          <HardDrive size={14} />
          Saved analytics
        </span>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void inspect()}
        >
          <FileUp size={16} />
          Import report
        </button>
      </div>
      {error && !preview && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <p className="dashboard-notice" role="status">
        {loading ? "Loading report…" : notice}
      </p>
      {data?.selected ? (
        <>
          <div className="report-selector">
            <div>
              <label htmlFor="saved-report">Saved report</label>
              <select
                id="saved-report"
                value={data.selected.id}
                onChange={(e) => {
                  setNotice("");
                  setError("");
                  setQuery({ ...initial, reportId: e.target.value });
                }}
              >
                {data.reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.channelName} · {r.kind === "daily" ? "Daily" : "Videos"}{" "}
                    ·{" "}
                    {r.periodStart
                      ? `${r.periodStart} to ${r.periodEnd}`
                      : "Period unspecified"}{" "}
                    · {r.fileName}
                  </option>
                ))}
              </select>
            </div>
            <span className="snapshot-pill">
              {data.selected.source?.startsWith("youtube")
                ? "YouTube API snapshot"
                : "Imported snapshot"}
            </span>
          </div>
          <div className="report-provenance">
            <span>{data.selected.fileName}</span>
            {data.selected.channelId && (
              <span>Channel {data.selected.channelId}</span>
            )}
            <span>
              Saved {new Date(data.selected.importedAt).toLocaleString()}
            </span>
            <span>
              {data.selected.periodStart
                ? `${data.selected.periodStart} — ${data.selected.periodEnd}`
                : data.selected.source === "youtube-uploads"
                  ? "Cumulative views at sync"
                  : "Period unknown / lifetime export"}
            </span>
          </div>
          {data.selected.kind === "daily" && (
            <div className="daily-filters">
              <span>Metric dates</span>
              <label htmlFor="filter-start">From</label>
              <input
                id="filter-start"
                type="date"
                value={query.startDate ?? data.selected.periodStart ?? ""}
                onChange={(e) =>
                  update({ startDate: e.target.value || undefined, page: 1 })
                }
              />
              <label htmlFor="filter-end">To</label>
              <input
                id="filter-end"
                type="date"
                min={query.startDate ?? undefined}
                value={query.endDate ?? data.selected.periodEnd ?? ""}
                onChange={(e) =>
                  update({ endDate: e.target.value || undefined, page: 1 })
                }
              />
              <button
                className="text-button"
                onClick={() =>
                  update({ startDate: undefined, endDate: undefined, page: 1 })
                }
              >
                Reset dates
              </button>
            </div>
          )}
          <div className="metric-grid">
            {[
              { label: "Views", value: number(data.totals.views) },
              {
                label: "Watch time",
                value: number(data.totals.watchHours, 2),
                unit: "hours",
              },
              {
                label: "Subscriber change",
                value: number(data.totals.subscribers),
              },
              {
                label: "Impressions",
                value: number(data.totals.impressions),
              },
            ].map((m) => (
              <div className="metric" key={m.label}>
                <span>{m.label}</span>
                <strong>
                  {m.value}
                  <small>{m.unit}</small>
                </strong>
              </div>
            ))}
          </div>
          <p className="metric-scope">
            <Info size={13} />
            Totals reflect matching saved rows in this snapshot, not live
            channel totals. Overlapping reports are never added together.
          </p>
          {data.warnings.length > 0 && (
            <details className="report-notes">
              <summary>
                {data.warnings.length} report note
                {data.warnings.length === 1 ? "" : "s"}
              </summary>
              <ul>
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <ReportChart
            points={data.series}
            daily={data.selected.kind === "daily"}
          />
          <ReportTable data={data} query={query} update={update} />
        </>
      ) : (
        !loading && (
          <section className="import-empty">
            <div className="welcome-symbol">
              <BarChart3 size={42} strokeWidth={1.3} />
            </div>
            <p className="eyebrow">YOUR DATA, ON YOUR MAC</p>
            <h2>Bring your channel into focus.</h2>
            <p>
              Import a YouTube Studio export to explore your videos,
              <br />
              views, watch time, and subscriber changes.
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void inspect()}
            >
              <FileUp size={16} />
              Choose CSV or JSON
            </button>
            <div className="import-guide">
              <h3>Get a report from YouTube Studio</h3>
              <p>
                Analytics → Advanced mode → choose your dates → Export current
                view → CSV.
              </p>
              <p>
                Unzip the download and choose the <strong>video table</strong>{" "}
                or <strong>daily totals</strong> file. This preview supports
                English column names. JSON arrays with the same fields also
                work.
              </p>
            </div>
            <span className="field-note">
              Imports work offline. Connect YouTube in Settings for live channel
              totals.
            </span>
          </section>
        )
      )}
      {preview && (
        <ImportDialog
          key={preview.previewId}
          preview={preview}
          busy={busy}
          error={error}
          onCancel={() => void cancel()}
          onCommit={(input) => void commit(input)}
        />
      )}
    </div>
  );
}
