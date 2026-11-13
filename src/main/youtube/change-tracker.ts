import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { CoreError } from "../../shared/contracts";
import { changeDraft, changeRecord, type ChangeRecord, type ChangeDraft } from "../../shared/youtube-changes";
import type { Store } from "../storage/store";

const PREFIX = "youtube-change:";
const MAX_RECORDS = 200;
const keyOf = (workspace: string, id: string) => `${PREFIX}${workspace}:${id}`;
function allRecords(db: DatabaseSync): ChangeRecord[] {
  const rows = db.prepare("SELECT key,value FROM settings WHERE key LIKE 'youtube-change:%' ORDER BY key").all();
  if (rows.length > MAX_RECORDS) throw new CoreError("INVALID_BACKUP", "Too many YouTube change records.");
  return rows.map((row) => {
    let decoded: unknown;
    try { decoded = JSON.parse(String(row.value)); }
    catch { throw new CoreError("INVALID_BACKUP", "Invalid YouTube change record."); }
    const parsed = changeRecord.safeParse(decoded);
    if (!parsed.success || row.key !== keyOf(parsed.data.workspaceId, parsed.data.id) ||
        Buffer.byteLength(String(row.value), "utf8") > 9000)
      throw new CoreError("INVALID_BACKUP", "Invalid YouTube change record.");
    return parsed.data;
  });
}
export function validateYouTubeChanges(db: DatabaseSync, workspaces: { id: string }[]) {
  const records = allRecords(db);
  for (const record of records) {
    if (!workspaces.some((workspace) => workspace.id === record.workspaceId))
      throw new CoreError("INVALID_BACKUP", "YouTube change record has no channel workspace.");
  }
}
export class YouTubeChanges {
  constructor(private readonly store: Store) {}
  private workspace(): string {
    const id = this.store.state().selectedWorkspaceId;
    if (!id) throw new CoreError("INVALID_INPUT", "Select a channel workspace first.");
    return id;
  }
  list(): ChangeRecord[] {
    const workspaceId = this.workspace();
    return allRecords(this.store.db)
      .filter((item) => item.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  save(input: { id?: string; value: ChangeDraft }): ChangeRecord[] {
    const workspaceId = this.workspace();
    const value = changeDraft.parse(input.value);
    const records = allRecords(this.store.db);
    const old = input.id ? records.find((record) => record.id === input.id && record.workspaceId === workspaceId) : null;
    if (input.id && !old) throw new CoreError("NOT_FOUND", "That change does not belong to this workspace.");
    if (!old && records.length >= MAX_RECORDS)
      throw new CoreError("STORAGE_UNAVAILABLE", "The change tracker has reached its 200-record limit.");
    const now = new Date().toISOString();
    const record = changeRecord.parse({
      ...value, id: old?.id ?? randomUUID(), workspaceId,
      createdAt: old?.createdAt ?? now, updatedAt: now,
    });
    const encoded = JSON.stringify(record);
    if (Buffer.byteLength(encoded, "utf8") > 9000)
      throw new CoreError("INVALID_INPUT", "This change record is too large.");
    this.store.transaction(() => {
      this.store.db.prepare(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(keyOf(workspaceId, record.id), encoded);
    });
    return this.list();
  }
  remove(input: { id: string }): ChangeRecord[] {
    const workspaceId = this.workspace();
    const result = this.store.transaction(() =>
      this.store.db.prepare("DELETE FROM settings WHERE key=?")
        .run(keyOf(workspaceId, z.uuid().parse(input.id))),
    );
    if (!result.changes) throw new CoreError("NOT_FOUND", "That change does not belong to this workspace.");
    return this.list();
  }
}
