import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { appearance, CoreError } from "../../shared/contracts";
import { parsedReport, reportSummary } from "../../shared/analytics";
export const CREATE_REPORTS = `CREATE TABLE reports (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), metadata TEXT NOT NULL, payload TEXT NOT NULL, fingerprint TEXT NOT NULL) STRICT;`;
export const SCHEMA_VERSION = 2;
const workspaceSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(80),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export function checkDatabase(db: DatabaseSync) {
  db.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON;");
  const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
  if (version !== 1 && version !== SCHEMA_VERSION)
    throw new CoreError(
      "UNSUPPORTED_VERSION",
      "This database requires a different app version. Your data has been preserved.",
    );
  if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
    throw new CoreError(
      "INVALID_BACKUP",
      "The database is damaged. Choose a different backup.",
    );
  const schema = db
    .prepare(
      "SELECT name, type FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
    )
    .all();
  if (
    schema.length !== (version === 1 ? 2 : 3) ||
    schema.some(
      (s) =>
        s.type !== "table" ||
        !(
          version === 1
            ? ["workspaces", "settings"]
            : ["workspaces", "settings", "reports"]
        ).includes(String(s.name)),
    )
  )
    throw new CoreError(
      "INVALID_BACKUP",
      "The backup contains unsupported database objects.",
    );
  const workspaces = db
    .prepare(
      "SELECT id, name, created_at AS createdAt, updated_at AS updatedAt FROM workspaces",
    )
    .all()
    .map((w) => workspaceSchema.parse(w));
  if (workspaces.length > 1000)
    throw new CoreError(
      "INVALID_BACKUP",
      "The backup contains too many workspaces.",
    );
  const settings = db.prepare("SELECT key, value FROM settings").all();
  for (const s of settings) {
    if (
      typeof s.key !== "string" ||
      typeof s.value !== "string" ||
      s.value.length > 10000
    )
      throw new CoreError("INVALID_BACKUP", "Invalid backup settings.");
    const value: unknown = JSON.parse(s.value);
    if (s.key === "appearance") appearance.parse(value);
    if (s.key === "sidebarCollapsed") z.boolean().parse(value);
    if (
      s.key === "selectedWorkspaceId" &&
      value !== null &&
      !workspaces.some((w) => w.id === value)
    )
      throw new CoreError(
        "INVALID_BACKUP",
        "The selected workspace is missing.",
      );
  }
  if (version === 2) {
    const records = db
      .prepare(
        "SELECT id,workspace_id,metadata,payload,fingerprint FROM reports",
      )
      .all();
    if (records.length > 200)
      throw new CoreError("INVALID_BACKUP", "Too many imported reports.");
    let bytes = 0;
    for (const record of records) {
      const metadata = reportSummary.parse(JSON.parse(String(record.metadata)));
      const payload = parsedReport.parse(JSON.parse(String(record.payload)));
      bytes += Buffer.byteLength(String(record.payload), "utf8");
      if (
        metadata.id !== record.id ||
        metadata.workspaceId !== record.workspace_id ||
        !workspaces.some((w) => w.id === metadata.workspaceId) ||
        metadata.rowCount !== payload.rows.length ||
        metadata.kind !== payload.kind ||
        !/^[a-f0-9]{64}$/.test(String(record.fingerprint))
      )
        throw new CoreError("INVALID_BACKUP", "An imported report is invalid.");
      if (payload.kind === "daily") {
        const dates = payload.rows.map((r) => r.date!).sort();
        if (
          metadata.periodStart !== dates[0] ||
          metadata.periodEnd !== dates.at(-1)
        )
          throw new CoreError(
            "INVALID_BACKUP",
            "The daily report period does not match its records.",
          );
      }
      if (
        metadata.periodStart !== null &&
        metadata.periodEnd !== null &&
        metadata.periodStart > metadata.periodEnd
      )
        throw new CoreError(
          "INVALID_BACKUP",
          "An imported report period is invalid.",
        );
    }
    if (
      bytes > 16 * 1024 * 1024 ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new CoreError(
        "INVALID_BACKUP",
        "Imported data exceeds the supported limit or has a missing workspace.",
      );
  }
  return workspaces;
}
