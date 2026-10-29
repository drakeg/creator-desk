import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpFromLine,
  Check,
  Clapperboard,
  FolderClosed,
  HardDrive,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CoreState, RestorePreview, Result } from "../shared/contracts";
import { Modal } from "./Dialog";
import { Sidebar } from "./Sidebar";
import { Settings } from "./Settings";
import { Dashboard } from "./Dashboard";
import { Overview, type Destination } from "./Overview";
export default function App() {
  const [state, setState] = useState<CoreState | null>(null);
  const [page, setPage] = useState<Destination>("Dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("My workspace");
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    void window.desktop
      .getState()
      .then((result) => {
        if (result.ok) setState(result.value);
        else setError(result.error.message);
      })
      .catch(() =>
        setError(
          "Creator Desk could not load. Quit and reopen the app to try again.",
        ),
      );
  }, []);
  useEffect(() => {
    if (state) document.documentElement.dataset.appearance = state.appearance;
  }, [state]);
  const ready = state !== null;
  useEffect(() => {
    if (!ready) return;
    let wasCompact = false;
    const resize = () => {
      const compact = window.innerWidth <= 1000;
      if (compact && !wasCompact) {
        void window.desktop
          .updateSidebar({ collapsed: true })
          .then((result) => {
            if (result.ok) setState(result.value);
            else setError(result.error.message);
          })
          .catch(() => setError("The sidebar preference could not be saved."));
      }
      wasCompact = compact;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [ready]);
  async function perform<T>(
    operation: () => Promise<Result<T>>,
    message: string | ((value: T) => string) = "",
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      if (!result.ok) {
        setError(result.error.message);
        return false;
      }
      const fresh = await window.desktop.getState();
      if (!fresh.ok) {
        setError(fresh.error.message);
        return false;
      }
      setState(fresh.value);
      setNotice(
        typeof message === "function" ? message(result.value) : message,
      );
      return true;
    } catch {
      setError(
        "The operation could not finish. Your saved data is preserved. Try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    await perform(async () => {
      const result = await window.desktop.inspectRestore();
      if (result.ok) setPreview(result.value);
      return result;
    });
  }
  function navigate(next: Destination) {
    setPage(next);
    setNotice("");
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  const selected = state?.workspaces.find(
    (w) => w.id === state.selectedWorkspaceId,
  );
  const firstLaunch = state?.workspaces.length === 0;
  const collapsed = state?.sidebarCollapsed;
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <div className="window-drag" aria-hidden="true" />
      <Sidebar
        state={state}
        page={page}
        busy={busy}
        navigate={navigate}
        perform={perform}
        onCreate={() => {
          setName("New workspace");
          setCreating(true);
        }}
      />
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{selected?.name ?? "Welcome"}</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{page}</strong>
          </div>
          <span className="local-badge">
            <span />
            Local workspace
          </span>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CREATOR DESK</p>
              <h1 ref={titleRef} tabIndex={-1}>
                {firstLaunch
                  ? "Make room for your next idea."
                  : page === "Dashboard"
                    ? "Channel overview"
                    : page}
              </h1>
            </div>
            <span className="build-label">LOCAL ANALYTICS</span>
          </div>
          {error && !creating && !preview && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="notice" role="status" aria-live="polite">
            {busy
              ? "Working…"
              : notice && (
                  <>
                    <Check size={15} />
                    {notice}
                  </>
                )}
          </div>
          {!state ? (
            <div className="loading-state">
              <HardDrive size={28} />
              <p>
                {error ? "Workspace unavailable" : "Opening your workspace…"}
              </p>
            </div>
          ) : firstLaunch && page !== "Settings" ? (
            <section className="welcome-content">
              <div className="welcome-symbol" aria-hidden="true">
                <Clapperboard size={48} strokeWidth={1.2} />
              </div>
              <p className="eyebrow">A FRESH START</p>
              <h2>
                Your next chapter
                <br />
                starts here.
              </h2>
              <p className="welcome-copy">
                A local home for your channel, research, and ideas.
                <br />
                Start with a workspace. Everything stays on your Mac.
              </p>
              <form
                className="welcome-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(
                    () => window.desktop.createWorkspace({ name }),
                    "Workspace created.",
                  );
                }}
              >
                <label htmlFor="first-workspace">Workspace name</label>
                <input
                  id="first-workspace"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  required
                />
                <button
                  className="button primary"
                  disabled={busy || !name.trim()}
                >
                  Create workspace
                  <ArrowRight size={17} />
                </button>
              </form>
              <button
                className="text-button restore-link"
                disabled={busy}
                onClick={() => void restore()}
              >
                <ArrowUpFromLine size={15} />
                Restore an existing backup
              </button>
              <div className="welcome-footer">
                <ShieldCheck size={15} />
                No account needed<span>·</span>Works offline
              </div>
            </section>
          ) : page === "Settings" ? (
            <Settings
              key={selected ? `${selected.id}:${selected.updatedAt}` : "empty"}
              state={state}
              busy={busy}
              perform={perform}
              restore={() => void restore()}
            />
          ) : page === "Dashboard" ? (
            <Dashboard key={selected?.id} />
          ) : (
            <Overview
              page={page}
              name={selected?.name ?? "Channel overview"}
              openSettings={() => navigate("Settings")}
            />
          )}
        </main>
        <footer className="main-footer">
          <span>
            <span className="status-dot" />
            Local storage
          </span>
          <span>Built for your next upload.</span>
        </footer>
      </div>
      {creating && (
        <Modal
          title="New workspace"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <p className="dialog-copy">
            Keep a separate space for another channel or creative project.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(
                () => window.desktop.createWorkspace({ name }),
                "Workspace created.",
              ).then((ok) => {
                if (ok) setCreating(false);
              });
            }}
          >
            <label htmlFor="new-name">Workspace name</label>
            <input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              required
              disabled={busy}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || !name.trim()}
              >
                Create workspace
              </button>
            </div>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal
          title="Restore this backup?"
          busy={busy}
          onClose={() => {
            void perform(() => window.desktop.cancelRestore()).then((ok) => {
              if (ok) setPreview(null);
            });
          }}
        >
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <p className="dialog-copy">
            This replaces <strong>all local workspaces and settings</strong>{" "}
            with the backup from {new Date(preview.createdAt).toLocaleString()}.
            A recovery backup will be saved first. Credentials are not replaced.
          </p>
          <div className="restore-workspaces">
            <span className="eyebrow">WORKSPACES IN THIS BACKUP</span>
            {preview.workspaces.length ? (
              <ul>
                {preview.workspaces.map((w) => (
                  <li key={w.id}>
                    <FolderClosed size={16} />
                    {w.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No workspaces.</p>
            )}
          </div>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void perform(() => window.desktop.cancelRestore()).then(
                  (ok) => {
                    if (ok) setPreview(null);
                  },
                )
              }
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void perform(
                  () =>
                    window.desktop.confirmRestore({
                      previewId: preview.previewId,
                    }),
                  "Backup restored.",
                ).then((ok) => {
                  if (ok) setPreview(null);
                })
              }
            >
              Restore all data
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
