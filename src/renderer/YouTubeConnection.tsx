import { GoogleSetup } from "./GoogleSetup";
import { useEffect, useState } from "react";
import type { Result } from "../shared/contracts";
import type { YouTubeState } from "../shared/youtube";
export function YouTubeConnection({
  settings = false,
  onReport,
}: {
  settings?: boolean;
  onReport?: (reportId: string) => void;
}) {
  const end = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStart] = useState(
    new Date(Date.parse(end) - 27 * 86400000).toISOString().slice(0, 10),
  );
  const [endDate, setEnd] = useState(end);
  const [state, setState] = useState<YouTubeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      void window.desktop
        .getYouTube()
        .then((result) => {
          if (!active) return;
          if (result.ok) setState(result.value);
          else setError(result.error.message);
        })
        .catch(() => {
          if (active) setError("The YouTube connection could not be loaded.");
        });
    load();
    const timer = state?.pending ? setInterval(load, 1500) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [state?.pending]);
  async function perform(
    operation: () => Promise<Result<YouTubeState | null>>,
    message = "",
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      if (result.ok) {
        if (result.value) {
          setState(result.value);
          setNotice(message);
        }
      } else setError(result.error.message);
    } catch {
      setError("The YouTube operation could not finish. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function syncReport(kind: "daily" | "uploads") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await (kind === "daily"
        ? window.desktop.syncYouTubeDaily({ startDate, endDate })
        : window.desktop.syncYouTubeUploads());
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setNotice(
        result.value.duplicate
          ? "Showing the existing identical snapshot."
          : "YouTube report saved locally.",
      );
      onReport?.(result.value.reportId);
      const fresh = await window.desktop.getYouTube();
      if (fresh.ok) setState(fresh.value);
    } catch {
      setError(
        "The report could not be synchronized. Saved reports are preserved.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!settings && !state?.connected && !state?.snapshot) return null;
  const snapshot = state?.snapshot;
  return (
    <section
      className="youtube-connection"
      aria-label="YouTube connection"
      aria-busy={busy}
    >
      <div className="setting-row">
        <div>
          <h2>YouTube connection</h2>
          <p>{snapshot?.title || "Read-only access to your channel."}</p>
        </div>
        {state?.connected && <span className="snapshot-pill">Connected</span>}
      </div>
      {(error || state?.error) && (
        <p className="alert" role="alert">
          {error || state?.error}
        </p>
      )}
      {(notice || state?.pending) && (
        <p role="status">
          {state?.pending
            ? "Waiting for Google sign-in in your browser…"
            : notice}
        </p>
      )}
      {snapshot && (
        <>
          <div className="metric-grid">
            {[
              ["Channel views", snapshot.views],
              ["Subscribers", snapshot.subscribers],
              ["Videos", snapshot.videos],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <strong>
                  {typeof value === "number"
                    ? value.toLocaleString()
                    : "Unavailable"}
                </strong>
              </div>
            ))}
          </div>
          <p className="field-note">
            Last successful sync: {new Date(snapshot.syncedAt).toLocaleString()}
            . Cached channel totals from YouTube Data API; subscriber counts may
            be rounded. These are separate from imported report periods.
          </p>
        </>
      )}
      <div className="youtube-actions">
        {state?.configured &&
          !state.connected &&
          !state.pending &&
          settings && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void perform(() => window.desktop.connectYouTube())
              }
            >
              Connect YouTube
            </button>
          )}
        {state?.pending && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void perform(
                () => window.desktop.cancelYouTube(),
                "Sign-in cancelled.",
              )
            }
          >
            Cancel sign-in
          </button>
        )}
        {state?.connected && (
          <>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void perform(
                  () => window.desktop.syncYouTube(),
                  "Channel snapshot updated.",
                )
              }
            >
              {busy ? "Syncing…" : "Sync channel"}
            </button>
            {settings && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDisconnecting(true)}
              >
                Disconnect YouTube
              </button>
            )}
          </>
        )}
      </div>
      {state?.connected && !settings && (
        <div className="youtube-report-controls">
          <h3>Save a YouTube report</h3>
          <p className="field-note">
            Daily metrics use the selected report dates. Uploads show cumulative
            video views, with at most 100 uploads per snapshot.
          </p>
          <div className="daily-filters">
            <label htmlFor="sync-start">Report from</label>
            <input
              id="sync-start"
              type="date"
              value={startDate}
              max={endDate}
              disabled={busy}
              onChange={(e) => setStart(e.target.value)}
            />
            <label htmlFor="sync-end">Report to</label>
            <input
              id="sync-end"
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().slice(0, 10)}
              disabled={busy}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <div className="youtube-actions">
            <button
              className="button secondary"
              disabled={busy || !startDate || !endDate}
              onClick={() => void syncReport("daily")}
            >
              Sync daily analytics
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void syncReport("uploads")}
            >
              Sync uploads
            </button>
          </div>
        </div>
      )}
      {disconnecting && (
        <div className="youtube-confirm">
          <p>
            Disconnect this workspace and remove its saved channel snapshot?
            Saved reports are kept. To revoke Google account permission, use
            your Google account’s third-party connections page.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setDisconnecting(false)}
          >
            Keep connected
          </button>{" "}
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void perform(
                () => window.desktop.disconnectYouTube(),
                "YouTube disconnected.",
              ).then(() => setDisconnecting(false))
            }
          >
            Confirm disconnect
          </button>
        </div>
      )}
      {settings && (
        <>
          <p className="field-note">
            {state?.clientSource === "app"
              ? "This build includes Creator Desk’s Google application. Click Connect YouTube; no Cloud project setup or JSON import is needed."
              : state?.clientSource === "custom"
                ? "Using your imported Google Desktop app configuration."
                : "This build has no preconfigured Google application yet. Follow the linked setup below once, then connect from the app."}
          </p>
          <GoogleSetup
            state={state}
            busy={busy}
            onImport={() =>
              void perform(
                () => window.desktop.importYouTubeClient(),
                "Google application credentials saved securely.",
              )
            }
            onUseApp={() =>
              void perform(
                () => window.desktop.useAppGoogleClient(),
                "Using Creator Desk’s Google configuration.",
              )
            }
          />
        </>
      )}
    </section>
  );
}
