import { GoogleSetup } from "./GoogleSetup";
import { useEffect, useState } from "react";
import type { Result } from "../shared/contracts";
import type { YouTubeState } from "../shared/youtube";
export function YouTubeConnection({
  settings = false,
  openDashboard,
}: {
  settings?: boolean;
  openDashboard?: () => void;
}) {
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
              onClick={openDashboard}
            >
              Open channel overview
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
      {disconnecting && (
        <div className="youtube-confirm">
          <p>
            Disconnect this channel and remove its saved channel snapshot? Saved
            reports are kept. To revoke Google account permission, use your
            Google account’s third-party connections page.
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
            Each channel has its own Google sign-in. The Desktop app credentials
            below are shared across channels; account access is separate. After
            connecting, open Channel overview to sync history automatically.
          </p>
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
