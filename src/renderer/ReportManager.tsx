import { useState } from "react";
import type { Dashboard, ManageReportInput } from "../shared/analytics";
import { Modal } from "./Dialog";
export function ReportManager({
  data,
  onChange,
}: {
  data: Dashboard;
  onChange: (value: Dashboard) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    id: string;
    name: string;
    action: "delete" | "purge";
  } | null>(null);
  async function perform(input: ManageReportInput) {
    setBusy(true);
    setError("");
    try {
      const result = await window.desktop.manageReport(input);
      if (result.ok) {
        onChange(result.value);
        setOpen(false);
        setConfirmation(null);
      } else setError(result.error.message);
    } catch {
      setError("The report could not be updated. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const title = confirmation
    ? confirmation.action === "purge"
      ? "Permanently remove report?"
      : "Delete this report?"
    : "Manage reports";
  return (
    <>
      <button
        className="button secondary"
        disabled={!data.reports.length && !data.deletedReports.length}
        onClick={() => {
          setName(
            data.selected?.displayName ?? data.selected?.channelName ?? "",
          );
          setError("");
          setConfirmation(null);
          setOpen(true);
        }}
      >
        Manage reports
      </button>
      {open && (
        <Modal
          title={title}
          busy={busy}
          onClose={() =>
            confirmation ? setConfirmation(null) : setOpen(false)
          }
        >
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {confirmation ? (
            <>
              <p className="dialog-copy">
                <strong>{confirmation.name}</strong>.{" "}
                {confirmation.action === "purge"
                  ? "This permanently removes this saved snapshot from the report library and cannot be undone here. Existing backups are unchanged."
                  : "This moves the saved snapshot to Deleted reports. You can restore it later. Original files, videos, and Shorts are unchanged."}
              </p>
              <div className="dialog-actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirmation(null)}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void perform({
                      reportId: confirmation.id,
                      action: confirmation.action,
                    })
                  }
                >
                  {confirmation.action === "purge"
                    ? "Remove permanently"
                    : "Delete report"}
                </button>
              </div>
            </>
          ) : (
            <>
              {data.selected && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void perform({
                      reportId: data.selected!.id,
                      action: "rename",
                      name,
                    });
                  }}
                >
                  <p className="dialog-copy">
                    Rename the selected snapshot without changing its channel,
                    date range, or imported data.
                  </p>
                  <label htmlFor="report-name">Report name</label>
                  <input
                    id="report-name"
                    autoFocus
                    required
                    maxLength={100}
                    value={name}
                    disabled={busy}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          id: data.selected!.id,
                          name:
                            data.selected!.displayName ??
                            data.selected!.channelName,
                          action: "delete",
                        })
                      }
                    >
                      Delete selected report
                    </button>
                    <button
                      className="button primary"
                      disabled={busy || !name.trim()}
                    >
                      Save report name
                    </button>
                  </div>
                </form>
              )}
              <section className="deleted-reports" aria-label="Deleted reports">
                <h3>Deleted reports ({data.deletedReports.length})</h3>
                <p className="field-note">
                  Deleted snapshots remain recoverable, stay in backups, and
                  count toward storage limits until permanently removed.
                </p>
                {!data.deletedReports.length && <p>No deleted reports.</p>}
                {data.deletedReports.map((report) => (
                  <article key={report.id}>
                    <strong>{report.displayName ?? report.channelName}</strong>
                    <p className="field-note">
                      {report.fileName} ·{" "}
                      {report.periodStart ?? "Unknown period"}
                    </p>
                    <div className="youtube-actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        aria-label={`Restore ${report.displayName ?? report.channelName}`}
                        onClick={() =>
                          void perform({
                            reportId: report.id,
                            action: "restore",
                          })
                        }
                      >
                        Restore
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        aria-label={`Permanently remove ${report.displayName ?? report.channelName}`}
                        onClick={() =>
                          setConfirmation({
                            id: report.id,
                            name: report.displayName ?? report.channelName,
                            action: "purge",
                          })
                        }
                      >
                        Remove permanently…
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
