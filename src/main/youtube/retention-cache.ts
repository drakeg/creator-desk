import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import {
  retentionPoint,
  retentionQuery,
  type RetentionPoint,
  type RetentionQuery,
} from "../../shared/retention";
import type { Store } from "../storage/store";

const PREFIX = "retention:";
const MAX_BYTES = 512 * 1024;
const MAX_RECORDS = 64;
const MAX_VALUE_BYTES = 10000;
const recordSchema = z.object({
  workspaceId: z.uuid(),
  query: retentionQuery,
  fetchedAt: z.iso.datetime({ offset: true }),
  points: z.array(retentionPoint).max(200),
}).strict();
export type RetentionCacheRecord = z.infer<typeof recordSchema>;
const keyOf = (record: Pick<RetentionCacheRecord, "workspaceId" | "query">) => {
  const { channelId, videoId, startDate, endDate } = record.query;
  return `${PREFIX}${record.workspaceId}:${channelId}:${videoId}:${startDate}:${endDate}`;
};
function invalid(): never {
  throw new CoreError("INVALID_BACKUP", "Saved retention history is invalid. Existing data is preserved.");
}
function validCurve(points: RetentionPoint[]) {
  let previous = -1;
  for (const point of points) {
    if (point.elapsedVideoTimeRatio <= previous) invalid();
    previous = point.elapsedVideoTimeRatio;
  }
}
function parseRecord(key: string, value: string): RetentionCacheRecord {
  let decoded: unknown;
  try { decoded = JSON.parse(value); } catch { return invalid(); }
  const parsed = recordSchema.safeParse(decoded);
  if (!parsed.success || keyOf(parsed.data) !== key ||
      Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) invalid();
  validCurve(parsed.data.points);
  return parsed.data;
}

/** Also runs on startup and during backup inspection, before restore activation. */
export function validateRetentionCache(
  db: DatabaseSync,
  workspaces: { id: string }[],
) {
  const rows = db.prepare(
    "SELECT key,value FROM settings WHERE key LIKE 'retention:%' ORDER BY key",
  ).all();
  if (rows.length > MAX_RECORDS) invalid();
  let bytes = 0;
  for (const row of rows) {
    const key = String(row.key);
    const value = String(row.value);
    bytes += Buffer.byteLength(value, "utf8");
    const parsed = parseRecord(key, value);
    if (!workspaces.some((workspace) => workspace.id === parsed.workspaceId)) invalid();
  }
  if (bytes > MAX_BYTES) invalid();
}

/**
 * Single-workspace retention cache. Empty points mean a successful request with
 * no available rows, not zero retention. Failures never overwrite old records.
 */
export class RetentionCache {
  private readonly workspaceId: string;
  constructor(private readonly store: Store) {
    const workspaceId = store.state().selectedWorkspaceId;
    if (!workspaceId) throw new CoreError("INVALID_INPUT", "Select a channel first.");
    this.workspaceId = workspaceId;
  }
  private check() {
    if (this.store.state().selectedWorkspaceId !== this.workspaceId) {
      throw new CoreError("CANCELLED", "The selected channel changed. Retention history is unchanged.");
    }
  }
  read(query: RetentionQuery): RetentionCacheRecord | null {
    this.check();
    const parsed = retentionQuery.parse(query);
    const key = keyOf({ workspaceId: this.workspaceId, query: parsed });
    const row = this.store.db.prepare("SELECT value FROM settings WHERE key=?").get(key);
    return row ? parseRecord(key, String(row.value)) : null;
  }
  save(
    query: RetentionQuery,
    points: RetentionPoint[],
    guard: () => void = () => {},
  ): RetentionCacheRecord {
    this.check();
    guard();
    const record = recordSchema.parse({
      workspaceId: this.workspaceId,
      query: retentionQuery.parse(query),
      fetchedAt: new Date().toISOString(),
      points,
    });
    validCurve(record.points);
    const key = keyOf(record);
    const value = JSON.stringify(record);
    if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) {
      throw new CoreError("STORAGE_UNAVAILABLE", "Retention curve exceeds the current per-video cache limit.");
    }
    return this.store.transaction(() => {
      this.check();
      guard();
      this.store.db.prepare(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(key, value);
      const count = Number(this.store.db.prepare(
        "SELECT count(*) AS n FROM settings WHERE key LIKE 'retention:%'",
      ).get()?.n);
      const bytes = Number(this.store.db.prepare(
        "SELECT COALESCE(sum(length(CAST(value AS BLOB))),0) AS n FROM settings WHERE key LIKE 'retention:%'",
      ).get()?.n);
      if (count > MAX_RECORDS || bytes > MAX_BYTES) {
        throw new CoreError("STORAGE_UNAVAILABLE", "Retention cache capacity reached; previous curves are preserved.");
      }
      this.check();
      guard();
      return record;
    });
  }
}
