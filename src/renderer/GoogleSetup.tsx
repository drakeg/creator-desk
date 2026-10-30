import { useState } from "react";
import { googleSetupPages, type GoogleSetupPage } from "../shared/google-setup";
import type { YouTubeState } from "../shared/youtube";
export function GoogleSetup({
  state,
  busy,
  onImport,
  onUseApp,
}: {
  state: YouTubeState | null;
  busy: boolean;
  onImport: () => void;
  onUseApp: () => void;
}) {
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const link = (page: GoogleSetupPage) => {
    const info = googleSetupPages[page];
    return (
      <a
        href={info.url}
        aria-disabled={busy || opening}
        onClick={(e) => {
          e.preventDefault();
          if (busy || opening) return;
          setOpening(true);
          setError("");
          void window.desktop
            .openGoogleSetup({ page })
            .then((result) => {
              if (!result.ok) setError(result.error.message);
            })
            .catch(() =>
              setError(
                "The browser could not be opened. Copy the URL below instead.",
              ),
            )
            .finally(() => setOpening(false));
        }}
      >
        {info.label}
        <code>{info.url}</code>
      </a>
    );
  };
  return (
    <details className="report-notes google-setup" open={!state?.configured}>
      <summary>
        {state?.clientSource === "app"
          ? "Use your own Google project (advanced)"
          : "Set up Google access"}
      </summary>
      <p>
        These steps are needed only when this build has no publisher-provided
        Google configuration, or when you choose your own project. Links open
        the exact Google page in your system browser. Keep the same project
        selected on every page.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <ol>
        <li>
          <strong>Create or select a project.</strong>
          {link("project")}
        </li>
        <li>
          <strong>Enable both APIs in that project.</strong>
          {link("dataApi")}
          {link("analyticsApi")}
        </li>
        <li>
          <strong>Configure Google Auth Platform.</strong>
          {link("branding")}
          {link("audience")}
          {link("scopes")}
          <p>
            If testing, add your Google account under Test users. In Data
            access, add the two read-only scopes:
          </p>
          <code>https://www.googleapis.com/auth/youtube.readonly</code>
          <code>https://www.googleapis.com/auth/yt-analytics.readonly</code>
        </li>
        <li>
          <strong>Create and download a Desktop app client.</strong>
          {link("clients")}
          <p>
            Choose application type <strong>Desktop app</strong>, create it, and
            download the JSON credentials while Google offers the download.
            Import that file below; a Web application client or API key will not
            work.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={busy || !!state?.connected || !!state?.pending}
            onClick={onImport}
          >
            {state?.clientSource === "custom"
              ? "Replace Google credentials"
              : "Import Google credentials"}
          </button>
        </li>
        <li>
          <strong>Connect and sync.</strong>
          <p>
            Return to Creator Desk, click Connect YouTube, approve both
            read-only permissions in your browser, then sync your channel. The
            app receives the result automatically; you do not copy tokens or
            enter your Google password here.
          </p>
        </li>
      </ol>
      {state?.clientSource === "custom" && state.appClientAvailable && (
        <button
          type="button"
          className="text-button"
          disabled={busy || state.connected || state.pending}
          onClick={onUseApp}
        >
          Use Creator Desk’s Google configuration
        </button>
      )}
      <p className="field-note">
        Credentials use OS protected storage and are excluded from backups.
        Linux requires an unlocked system keyring. Older connections may need to
        reconnect to grant both permissions. Google sign-in runs in your system
        browser; Google Cloud project creation and verification cannot be
        completed by this wizard.
      </p>
      {link("connections")}
    </details>
  );
}
