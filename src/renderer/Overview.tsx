import {
  ArrowRight,
  Check,
  FolderClosed,
  HardDrive,
  Link2,
  Sparkles,
  CircleDashed,
  Compass,
  Users,
  LayoutGrid,
  Clapperboard,
} from "lucide-react";
const modules = {
  Dashboard: {
    title: "A clearer view of your channel.",
    text: "Import creator analytics, connect read-only YouTube data, and review your saved snapshots.",
    icon: LayoutGrid,
    stage: "Stage 1 · Channel insights",
  },
  Research: {
    title: "Find the next story worth telling.",
    text: "Keyword research, outlier videos, rising topics, and thumbnail references will help turn curiosity into your next video.",
    icon: Compass,
    stage: "Stage 2 · Discovery",
  },
  Competitors: {
    title: "Learn from the channels around you.",
    text: "Track channels, compare performance, and spot the videos breaking through. Comparisons will use real snapshots with visible sources and dates.",
    icon: Users,
    stage: "Stage 2 · Competitor tracking",
  },
  Projects: {
    title: "Give your ideas room to grow.",
    text: "Save ideas, gather references, write briefs, and plan your publishing calendar in one local workspace.",
    icon: FolderClosed,
    stage: "Stage 2 · Project planner",
  },
  Studio: {
    title: "Shape your next upload.",
    text: "Create Shorts from local videos, edit captions, and optionally use your chosen AI provider for transcription and clip suggestions.",
    icon: Clapperboard,
    stage: "Stages 3–5 · Creator tools",
  },
};
export type Destination = keyof typeof modules | "Settings";
export function Overview({
  page,
  name,
  openSettings,
  openDashboard,
}: {
  page: keyof typeof modules;
  name: string;
  openSettings: () => void;
  openDashboard: () => void;
}) {
  const module = modules[page];
  const Icon = module.icon;
  return (
    <div className="overview-content">
      <div className="module-banner">
        <span className="pill">
          <CircleDashed size={13} />
          Planned
        </span>
        <span>{module.stage}</span>
      </div>
      <div className="empty-illustration" aria-hidden="true">
        <div className="illustration-orbit" />
        <div className="illustration-tile">
          <Icon size={38} strokeWidth={1.3} />
        </div>
        <div className="illustration-spark">
          <Sparkles size={16} />
        </div>
      </div>
      <div className="module-intro">
        <p className="eyebrow">
          {page === "Dashboard"
            ? "YOUR LOCAL STARTING POINT"
            : page.toUpperCase()}
        </p>
        <h2>{module.title}</h2>
        <p>{module.text}</p>
      </div>
      <div className="setup-list">
        <div>
          <span className="step-icon complete">
            <Check size={16} />
          </span>
          <div>
            <strong>Workspace ready</strong>
            <p>{name} is saved on this Mac.</p>
          </div>
          <span className="step-status">Complete</span>
        </div>
        <div>
          <span className="step-icon">
            <Link2 size={16} />
          </span>
          <div>
            <strong>Bring your channel data</strong>
            <p>CSV/JSON imports and a live YouTube connection.</p>
          </div>
          <button className="text-button" onClick={openDashboard}>
            Open Dashboard <ArrowRight size={16} />
          </button>
        </div>
        <div>
          <span className="step-icon">
            <HardDrive size={16} />
          </span>
          <div>
            <strong>Keep your work safe</strong>
            <p>Manage appearance, storage, and backups.</p>
          </div>
          <button className="text-button" onClick={openSettings}>
            Settings
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <p className="module-footnote">
        This module is planned. Analytics imports and YouTube connections are
        available in Dashboard; Shorts tools are available in Studio.
      </p>
    </div>
  );
}
