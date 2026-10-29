import { useState } from "react";
import {
  ArrowDownToLine,
  FolderOpen,
  Monitor,
  Moon,
  Sun,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import type { CoreState, Result } from "../shared/contracts";
type Perform = <T>(
  operation: () => Promise<Result<T>>,
  message?: string | ((value: T) => string),
) => Promise<boolean>;
interface Props {
  state: CoreState;
  busy: boolean;
  perform: Perform;
  restore: () => void;
}
export function Settings({ state, busy, perform, restore }: Props) {
  const workspace = state.workspaces.find(
    (w) => w.id === state.selectedWorkspaceId,
  );
  const [name, setName] = useState(workspace?.name ?? "");
  return (
    <div className="settings-content">
      <section className="settings-section">
        <div className="section-label">
          <span className="section-number">01</span>
          <div>
            <h2>Workspace</h2>
            <p>A home for your channels, research, and ideas.</p>
          </div>
        </div>
        {workspace ? (
          <form
            className="settings-body"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(
                () =>
                  window.desktop.renameWorkspace({ id: workspace.id, name }),
                "Workspace name saved.",
              );
            }}
          >
            <label htmlFor="workspace-name">Workspace name</label>
            <div className="inline-form">
              <input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                disabled={busy}
              />
              <button
                className="button secondary"
                disabled={
                  busy || name.trim() === workspace.name || !name.trim()
                }
              >
                Save name
              </button>
            </div>
            <p className="field-note">
              Stored on this Mac. You can rename it anytime.
            </p>
          </form>
        ) : (
          <p className="settings-body muted">
            Create a workspace to get started.
          </p>
        )}
      </section>
      <section className="settings-section">
        <div className="section-label">
          <span className="section-number">02</span>
          <div>
            <h2>Appearance</h2>
            <p>Make yourself comfortable.</p>
          </div>
        </div>
        <div className="settings-body">
          <div
            className="appearance-options"
            role="group"
            aria-label="Appearance"
          >
            {(
              [
                { mode: "system", label: "System", icon: Monitor },
                { mode: "light", label: "Light", icon: Sun },
                { mode: "dark", label: "Dark", icon: Moon },
              ] as const
            ).map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                className="appearance-option"
                aria-pressed={state.appearance === mode}
                disabled={busy}
                onClick={() =>
                  void perform(
                    () => window.desktop.updateAppearance({ mode }),
                    "Appearance saved.",
                  )
                }
              >
                <Icon size={20} />
                <span>{label}</span>
                <span className="radio-mark" />
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div className="section-label">
          <span className="section-number">03</span>
          <div>
            <h2>Data & backups</h2>
            <p>Your work stays with you.</p>
          </div>
        </div>
        <div className="settings-body">
          <div className="data-location">
            <HardDrive size={20} />
            <div>
              <strong>Local storage</strong>
              <code>{state.dataLocation}</code>
            </div>
            <button
              className="icon-button"
              aria-label="Open data folder"
              disabled={busy}
              onClick={() =>
                void perform(() => window.desktop.openDataFolder())
              }
            >
              <FolderOpen size={18} />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <h3>Export a backup</h3>
              <p>All workspaces and settings. Credentials are excluded.</p>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void perform(
                  () => window.desktop.exportBackup(),
                  (value) => (value.cancelled ? "" : "Backup export finished."),
                )
              }
            >
              <ArrowDownToLine size={16} />
              Export
            </button>
          </div>
          <div className="setting-row">
            <div>
              <h3>Restore from a backup</h3>
              <p>Preview the file before replacing your local data.</p>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={restore}
            >
              Choose backup
            </button>
          </div>
          <p className="field-note">
            Backup limit: 24 MB of database data / 32 MB per file. Recovery
            backups remain in the backups folder until you remove them.
          </p>
        </div>
      </section>
      <div className="privacy-note">
        <ShieldCheck size={20} />
        <p>
          No account required. No analytics or automatic uploads.
          <br />
          <span>Creator Desk {state.version} · Desktop core preview</span>
        </p>
      </div>
    </div>
  );
}
