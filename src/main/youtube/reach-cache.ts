import { createHash } from "node:crypto";
import { reportingDay } from "./reach-download";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { CoreError } from "../../shared/contracts";
import {
  reachManifest,
  reachChunk,
  reachRow,
  reachChannelId,
  REACH_CACHE_LIMIT,
  type ReachBatch,
  type ReachManifest,
  type ReachRow,
} from "../../shared/reach";
import type { Store } from "../storage/store";
const prefix = (workspace: string, channel: string) =>
  `reach:${workspace}:${channel}:`;
export const reachHash = (rows: ReachRow[]) =>
  createHash("sha256").update(JSON.stringify(rows)).digest("hex");
function validPeriod(metadata: ReachManifest) {
  const start = Date.parse(metadata.startTime),
    end = Date.parse(metadata.endTime);
  return (
    end > start &&
    reportingDay(metadata.startTime) === metadata.day &&
    reportingDay(new Date(start - 1).toISOString()) !== metadata.day &&
    reportingDay(new Date(end - 1).toISOString()) === metadata.day &&
    reportingDay(metadata.endTime) !== metadata.day
  );
}
function bad(): never {
  throw new CoreError(
    "INVALID_BACKUP",
    "Saved reach history is invalid. Existing data is preserved.",
  );
}
/** Validates the reserved cache namespace during startup and backup inspection. */
export function validateReachCache(
  db: DatabaseSync,
  workspaces: { id: string }[],
) {
  const entries = db
    .prepare("SELECT key,value FROM settings WHERE key LIKE 'reach:%'")
    .all();
  const records = new Map<string, string>();
  let bytes = 0;
  for (const entry of entries) {
    const key = String(entry.key),
      value = String(entry.value);
    records.set(key, value);
    bytes += Buffer.byteLength(value, "utf8");
    if (value.length > 10000) bad();
  }
  if (bytes > REACH_CACHE_LIMIT) bad();
  const used = new Set<string>();
  for (const [key, value] of records) {
    if (!key.endsWith(":meta")) continue;
    const parsed = reachManifest.safeParse(JSON.parse(value));
    if (!parsed.success) bad();
    const metadata = parsed.data;
    const base =
      prefix(metadata.workspaceId, metadata.channelId) + metadata.day;
    if (
      key !== base + ":meta" ||
      !workspaces.some((w) => w.id === metadata.workspaceId)
    )
      bad();
    used.add(key);
    const rows: ReachRow[] = [];
    for (let part = 0; part < metadata.parts; part++) {
      const name = `${base}:${part}`;
      const content = records.get(name);
      if (!content) bad();
      const chunk = reachChunk.safeParse(JSON.parse(content));
      if (!chunk.success) bad();
      rows.push(...chunk.data);
      used.add(name);
    }
    if (
      !validPeriod(metadata) ||
      reachHash(rows) !== metadata.sha256 ||
      rows.length !== metadata.rowCount ||
      metadata.parts !== Math.ceil(metadata.rowCount / 100) ||
      new Set(rows.map((r) => r[0])).size !== rows.length
    )
      bad();
  }
  if (used.size !== records.size) bad();
}
export class ReachCache {
  private workspaceId: string;
  constructor(
    private store: Store,
    private channelId: string,
  ) {
    reachChannelId.parse(channelId);
    const id = store.state().selectedWorkspaceId;
    if (!id) throw new CoreError("INVALID_INPUT", "Select a channel first.");
    this.workspaceId = id;
  }
  private check() {
    if (this.store.state().selectedWorkspaceId !== this.workspaceId)
      throw new CoreError(
        "CANCELLED",
        "The selected channel changed. Reach history is unchanged.",
      );
  }
  metadata(): ReachManifest[] {
    this.check();
    const records = this.store.db
      .prepare("SELECT value FROM settings WHERE key GLOB ? ORDER BY key")
      .all(prefix(this.workspaceId, this.channelId) + "*:meta");
    return records.map((record) =>
      reachManifest.parse(JSON.parse(String(record.value))),
    );
  }
  read(): ReachBatch[] {
    return this.metadata().map((metadata) => {
      const rows: ReachRow[] = [];
      for (let part = 0; part < metadata.parts; part++) {
        const record = this.store.db
          .prepare("SELECT value FROM settings WHERE key=?")
          .get(
            prefix(this.workspaceId, this.channelId) +
              `${metadata.day}:${part}`,
          );
        if (!record) bad();
        rows.push(...reachChunk.parse(JSON.parse(String(record.value))));
      }
      if (rows.length !== metadata.rowCount) bad();
      return { metadata, rows };
    });
  }
  publish(batches: ReachBatch[], guard: () => void = () => {}) {
    this.check();
    guard();
    const parsed = batches.map((batch) => ({
      metadata: reachManifest.parse(batch.metadata),
      rows: z.array(reachRow).max(20000).parse(batch.rows),
    }));
    if (!parsed.length) return 0;
    const days = new Set<string>();
    for (const { metadata, rows } of parsed) {
      if (
        !validPeriod(metadata) ||
        reachHash(rows) !== metadata.sha256 ||
        metadata.workspaceId !== this.workspaceId ||
        metadata.channelId !== this.channelId ||
        metadata.rowCount !== rows.length ||
        metadata.parts !== Math.ceil(rows.length / 100) ||
        days.has(metadata.day) ||
        new Set(rows.map((r) => r[0])).size !== rows.length
      )
        bad();
      days.add(metadata.day);
    }
    return this.store.transaction(() => {
      const existing = new Map(
        this.metadata().map((metadata) => [metadata.day, metadata]),
      );
      let updated = 0;
      for (const { metadata, rows } of parsed) {
        const previous = existing.get(metadata.day);
        if (previous) {
          const order =
            Date.parse(metadata.createTime) - Date.parse(previous.createTime);
          if (order < 0) continue;
          if (order === 0) {
            if (
              previous.sha256 !== metadata.sha256 ||
              previous.reportId !== metadata.reportId ||
              previous.jobId !== metadata.jobId ||
              Date.parse(previous.startTime) !==
                Date.parse(metadata.startTime) ||
              Date.parse(previous.endTime) !== Date.parse(metadata.endTime)
            )
              bad();
            continue;
          }
          if (
            Date.parse(previous.startTime) !== Date.parse(metadata.startTime) ||
            Date.parse(previous.endTime) !== Date.parse(metadata.endTime)
          )
            bad();
        }
        const base = prefix(this.workspaceId, this.channelId) + metadata.day;
        this.store.db
          .prepare("DELETE FROM settings WHERE key GLOB ?")
          .run(base + ":*");
        const put = this.store.db.prepare(
          "INSERT INTO settings(key,value) VALUES(?,?)",
        );
        put.run(base + ":meta", JSON.stringify(metadata));
        for (let part = 0; part < metadata.parts; part++) {
          const content = JSON.stringify(
            rows.slice(part * 100, (part + 1) * 100),
          );
          if (content.length > 10000) bad();
          put.run(`${base}:${part}`, content);
        }
        updated++;
      }
      this.check();
      guard();
      const bytes = Number(
        this.store.db
          .prepare(
            "SELECT COALESCE(SUM(length(CAST(value AS BLOB))),0) AS bytes FROM settings WHERE key LIKE 'reach:%'",
          )
          .get()?.bytes,
      );
      if (bytes > REACH_CACHE_LIMIT)
        throw new CoreError(
          "STORAGE_UNAVAILABLE",
          "The 4 MiB reach-history limit was reached. Previous reach history is unchanged.",
        );
      return updated;
    });
  }
}
