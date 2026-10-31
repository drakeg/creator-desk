import {
  ChevronDown,
  Clapperboard,
  Compass,
  FolderClosed,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { CoreState, Result } from "../shared/contracts";
import type { Destination } from "./Overview";
interface Props {
  state: CoreState | null;
  page: Destination;
  busy: boolean;
  navigate: (page: Destination) => void;
  onCreate: () => void;
  perform: <T>(
    operation: () => Promise<Result<T>>,
    message?: string | ((value: T) => string),
  ) => Promise<boolean>;
}
const navigation = [
  { name: "Dashboard", icon: LayoutGrid },
  { name: "Research", icon: Compass },
  { name: "Competitors", icon: Users },
  { name: "Projects", icon: FolderClosed },
  { name: "Studio", icon: Clapperboard },
] as const;
export function Sidebar({
  state,
  page,
  busy,
  navigate,
  onCreate,
  perform,
}: Props) {
  const selected = state?.workspaces.find(
    (w) => w.id === state.selectedWorkspaceId,
  );
  const collapsed = state?.sidebarCollapsed;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Clapperboard size={20} strokeWidth={1.6} />
        </div>
        <span>
          creator<span className="brand-light">desk</span>
        </span>
      </div>
      <div className="workspace-picker">
        <div className="workspace-avatar">
          {selected?.name.slice(0, 1).toUpperCase() ?? "W"}
        </div>
        <div className="workspace-select">
          <span>WORKSPACE</span>
          <label className="sr-only" htmlFor="workspace-select">
            Current workspace
          </label>
          <select
            id="workspace-select"
            disabled={busy || !state?.workspaces.length}
            value={state?.selectedWorkspaceId ?? ""}
            onChange={(e) =>
              void perform(() =>
                window.desktop.selectWorkspace({ id: e.target.value }),
              )
            }
          >
            {state?.workspaces.length ? (
              state.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))
            ) : (
              <option value="">Get started</option>
            )}
          </select>
        </div>
        <ChevronDown className="select-chevron" size={14} />
      </div>
      <button
        className="new-workspace"
        aria-label="New workspace"
        disabled={busy || !state}
        onClick={onCreate}
      >
        <Plus size={16} />
        <span>New workspace</span>
      </button>
      <div className="nav-label">YOUR DESK</div>
      <nav aria-label="Main navigation">
        {navigation.map(({ name, icon: Icon }) => (
          <button
            key={name}
            aria-current={page === name ? "page" : undefined}
            title={collapsed ? name : undefined}
            aria-label={name}
            onClick={() => navigate(name)}
            disabled={busy}
          >
            <Icon size={18} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note">
          <ShieldCheck size={17} />
          <div>
            <strong>Local by design</strong>
            <p>Your work. On your Mac.</p>
          </div>
        </div>
        <button
          className={`settings-nav ${page === "Settings" ? "selected" : ""}`}
          aria-label="Settings"
          disabled={busy}
          onClick={() => navigate("Settings")}
        >
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
        <div className="sidebar-footer">
          <span>
            DESKTOP PREVIEW <span className="version">0.7</span>
          </span>
          <button
            className="icon-button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            disabled={busy || !state}
            onClick={() =>
              void perform(() =>
                window.desktop.updateSidebar({ collapsed: !collapsed }),
              )
            }
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
