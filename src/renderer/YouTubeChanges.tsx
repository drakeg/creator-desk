import { useEffect, useState } from "react";
import type { ChangeDraft, ChangeRecord } from "../shared/youtube-changes";

const categories: { value: ChangeDraft["category"]; label: string }[] = [
  { value: "monetization", label: "Monetization eligibility" },
  { value: "shorts", label: "Shorts" },
  { value: "long_form", label: "Long-form features" },
  { value: "sponsorship", label: "Sponsorship opportunities" },
  { value: "affiliate_disclosure", label: "Affiliate disclosures" },
  { value: "policy", label: "Official policy" },
];
const views: { value: ChangeDraft["status"] | "all"; label: string }[] = [
  { value: "new", label: "New changes" },
  { value: "verify", label: "To verify" },
  { value: "in_progress", label: "Actions in progress" },
  { value: "completed", label: "Completed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All changes" },
];
const empty: ChangeDraft = {
  category: "policy", title: "", sourceUrl: "", publishedDate: null,
  effectiveDate: null, description: "", channelImpact: "",
  requiredAction: "", verification: "unverified", status: "new",
  followUpDate: null, notes: "",
};
export function YouTubeChanges({ channelName }: { channelName: string }) {
  const [items, setItems] = useState<ChangeRecord[]>([]);
  const [view, setView] = useState<ChangeDraft["status"] | "all">("new");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChangeDraft>(empty);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void window.desktop.listYouTubeChanges().then((r) => {
      if (!active) return;
      if (r.ok) setItems(r.value);
      else setError(r.error.message);
    }).catch(() => { if (active) setError("Saved YouTube changes could not be loaded."); });
    return () => { active = false; };
  }, []);
  const update = <K extends keyof ChangeDraft>(name: K, value: ChangeDraft[K]) =>
    setDraft((previous) => ({ ...previous, [name]: value }));
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await window.desktop.saveYouTubeChange({ ...(editing ? { id: editing } : {}), value: draft });
      if (!result.ok) { setError(result.error.message); return; }
      setItems(result.value);
      setMessage(editing ? "Change updated." : "Change saved.");
      setShowForm(false); setEditing(null); setDraft(empty);
    } catch { setError("The change could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Permanently remove this change record? Use Dismissed to keep an audit trail.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await window.desktop.removeYouTubeChange({ id });
      if (!result.ok) setError(result.error.message);
      else { setItems(result.value); setMessage("Change removed."); }
    } catch { setError("The change could not be removed."); }
    finally { setBusy(false); }
  }
  function edit(item: ChangeRecord) {
    const { id: _id, workspaceId: _workspaceId, createdAt: _createdAt, updatedAt: _updatedAt, ...value } = item;
    setEditing(item.id); setDraft(value); setShowForm(true); setError(""); setMessage("");
  }
  const visible = items.filter((item) => view === "all" || item.status === view);
  return <section className="youtube-change-tracker" aria-label="YouTube change tracker">
    <h2>Creator change intelligence</h2>
    <p className="field-note">
      Track official YouTube platform, monetization, Shorts, sponsorship and disclosure changes
      for {channelName}. Sources are manually verified; no rumors, automatic eligibility claims or guessed dates.
      Unknown publication and effective dates remain blank.
    </p>
    <div className="change-toolbar">
      <label htmlFor="youtube-change-view">View</label>
      <select id="youtube-change-view" value={view} onChange={(e) => setView(e.target.value as typeof view)}>
        {views.map((entry) => <option key={entry.value} value={entry.value}>
          {entry.label} ({entry.value === "all" ? items.length : items.filter((i) => i.status === entry.value).length})
        </option>)}
      </select>
      <button className="button primary" type="button" onClick={() => {
        setEditing(null); setDraft(empty); setShowForm(true); setError(""); setMessage("");
      }}>Add verified-source change</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {showForm && <form className="change-editor" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h3>{editing ? "Edit change" : "Record a change"}</h3>
      <div className="change-fields">
        <label>Category
          <select value={draft.category} onChange={(e) => update("category", e.target.value as ChangeDraft["category"])}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>Title<input required maxLength={160} value={draft.title} onChange={(e) => update("title", e.target.value)} /></label>
        <label>Official source URL<input required type="url" value={draft.sourceUrl} placeholder="https://support.google.com/youtube/..." onChange={(e) => update("sourceUrl", e.target.value)} /></label>
        <label>Publication date (if known)<input type="date" value={draft.publishedDate ?? ""} onChange={(e) => update("publishedDate", e.target.value || null)} /></label>
        <label>Effective date (if known)<input type="date" value={draft.effectiveDate ?? ""} onChange={(e) => update("effectiveDate", e.target.value || null)} /></label>
        <label>Follow-up date<input type="date" value={draft.followUpDate ?? ""} onChange={(e) => update("followUpDate", e.target.value || null)} /></label>
        <label>Verification
          <select value={draft.verification} onChange={(e) => update("verification", e.target.value as ChangeDraft["verification"])}>
            <option value="unverified">Needs verification</option>
            <option value="tentative">Tentative / not confirmed</option>
            <option value="verified">Verified against source</option>
            <option value="not_applicable">Not applicable</option>
          </select>
        </label>
        <label>Workflow status
          <select value={draft.status} onChange={(e) => update("status", e.target.value as ChangeDraft["status"])}>
            {views.filter((v) => v.value !== "all").map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>
      </div>
      <label>What changed?<textarea required maxLength={1800} rows={3} value={draft.description} onChange={(e) => update("description", e.target.value)} /></label>
      <label>Why does it matter for {channelName}?<textarea required maxLength={1200} rows={2} value={draft.channelImpact} onChange={(e) => update("channelImpact", e.target.value)} /></label>
      <label>Required action<textarea required maxLength={1200} rows={2} value={draft.requiredAction} onChange={(e) => update("requiredAction", e.target.value)} /></label>
      <label>Notes / verification evidence<textarea maxLength={1200} rows={2} value={draft.notes} onChange={(e) => update("notes", e.target.value)} /></label>
      <div className="change-toolbar">
        <button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save change"}</button>
        <button className="button secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
      </div>
    </form>}
    {!visible.length && <p role="status">No changes in this view. Add a record using a verified official source.</p>}
    <div className="change-cards">
      {visible.map((item) => <article className="change-card" key={item.id}>
        <div className="change-card-heading">
          <h3>{item.title}</h3>
          <span>{categories.find((c) => c.value === item.category)?.label}</span>
        </div>
        <p><strong>Source:</strong> <span className="source-url">{item.sourceUrl}</span></p>
        <p><strong>Published:</strong> {item.publishedDate ?? "Unknown"} · <strong>Effective:</strong> {item.effectiveDate ?? "Unknown"}</p>
        <p><strong>Verification:</strong> {item.verification.replaceAll("_", " ")} · <strong>Follow-up:</strong> {item.followUpDate ?? "Not scheduled"}</p>
        <p><strong>What changed:</strong> {item.description}</p>
        <p><strong>Why it matters:</strong> {item.channelImpact}</p>
        <p><strong>Required action:</strong> {item.requiredAction}</p>
        {item.notes && <p><strong>Evidence / notes:</strong> {item.notes}</p>}
        <div className="change-toolbar">
          <button type="button" className="button secondary" onClick={() => edit(item)}>Edit / verify</button>
          <button type="button" className="button secondary" disabled={busy}
            onClick={() => { void remove(item.id); }}>Remove</button>
          <button type="button" className="button secondary" onClick={() => { void navigator.clipboard.writeText(item.sourceUrl); }}>Copy source URL</button>
        </div>
      </article>)}
    </div>
  </section>;
}
