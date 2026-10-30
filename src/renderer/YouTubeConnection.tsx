import { useEffect, useState } from "react";
import type { Result } from "../shared/contracts";
import type { YouTubeState } from "../shared/youtube";
export function YouTubeConnection({
  settings = false,
}: {
  settings?: boolean;
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
        {settings && !state?.connected && !state?.pending && (
          <button
            className="button secondary"
            disabled={busy || !state}
            onClick={() =>
              void perform(
                () => window.desktop.importYouTubeClient(),
                "Google application credentials saved securely.",
              )
            }
          >
            {state?.configured
              ? "Replace Google credentials"
              : "Import Google credentials"}
          </button>
        )}
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
      {disconnecting && (
        <div className="youtube-confirm">
          <p>
            Disconnect this workspace and remove its saved channel snapshot?
            Imported reports are kept. To revoke Google account permission, use
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
        <details className="report-notes">
          <summary>Set up Google access</summary>
          <ol>
            <li>
              In Google Cloud, create a project and enable YouTube Data API v3.
            </li>
            <li>
              Configure Google Auth Platform consent. If the app is in testing,
              add your Google account as a test user.
            </li>
            <li>
              Create an OAuth client with application type Desktop app and
              download its JSON credentials. Import that file here.
            </li>
            <li>
              Connect in your system browser, then sync your channel. No Google
              password is entered into Creator Desk.
            </li>
          </ol>
          <p>
            Credentials use your operating system’s protected storage and are
            excluded from backups. Linux requires an unlocked system keyring.
            Read-only channel totals are supported in this stage; watch time,
            retention, and daily analytics still use imports.
          </p>
        </details>
      )}
    </section>
  );
}
