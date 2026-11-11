import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { Backups } from "../../src/main/storage/backups";
import { checkDatabase } from "../../src/main/storage/schema";
import {
  ReachCache,
  reachHash,
  validateReachCache,
} from "../../src/main/youtube/reach-cache";
import type { ReachBatch, ReachRow } from "../../src/shared/reach";
import { ingestReachReports } from "../../src/main/youtube/reach-ingest";
const channel = "UC1234567890123456789012",
  stores: Store[] = [];
function setup() {
  const store = new Store(mkdtempSync(join(tmpdir(), "reach-cache-")));
  stores.push(store);
  const workspace = store.create({ name: "First channel" });
  return { store, id: workspace.id, cache: new ReachCache(store, channel) };
}
afterEach(() => {
  for (const store of stores) {
    store.close();
    rmSync(store.root, { recursive: true, force: true });
  }
  stores.length = 0;
});
function batch(
  id: string,
  options: Partial<ReachBatch["metadata"]> = {},
  rows: ReachRow[] = [["abcdefghijk", 1000, 5]],
): ReachBatch {
  return {
    metadata: {
      workspaceId: id,
      channelId: channel,
      jobId: "job",
      reportId: "report",
      day: "2026-11-01",
      startTime: "2026-11-01T07:00:00Z",
      endTime: "2026-11-02T08:00:00Z",
      createTime: "2026-11-03T00:00:00Z",
      downloadedAt: "2026-11-04T00:00:00Z",
      rowCount: rows.length,
      parts: Math.ceil(rows.length / 100),
      sha256: reachHash(rows),
      ...options,
    },
    rows,
  };
}
it("replays idempotently, replaces newer revisions and rejects conflicting timestamps", () => {
  const { store, id, cache } = setup();
  const original = batch(id);
  expect(cache.publish([original])).toBe(1);
  expect(cache.publish([original])).toBe(0);
  expect(
    cache.publish([
      batch(id, { reportId: "older", createTime: "2026-11-02T00:00:00Z" }),
    ]),
  ).toBe(0);
  const revision = batch(
    id,
    { reportId: "revised", createTime: "2026-11-04T00:00:00Z" },
    [["abcdefghijk", 2000, 6]],
  );
  cache.publish([revision]);
  expect(cache.read()[0].rows[0][1]).toBe(2000);
  expect(() =>
    cache.publish([
      batch(id, {
        reportId: "conflict",
        createTime: revision.metadata.createTime,
      }),
    ]),
  ).toThrow();
  expect(cache.read()[0].metadata.reportId).toBe("revised");
  checkDatabase(store.db);
});
it("includes multi-part and empty reports in backup/restore without URLs or credentials", async () => {
  const { store, id, cache } = setup();
  const rows: ReachRow[] = Array.from({ length: 250 }, (_, n) => [
    `vid${String(n).padStart(8, "0")}`,
    n,
    5,
  ]);
  const original = batch(id, {}, rows);
  cache.publish([original]);
  const path = join(store.root, "reach.creatorbackup"),
    backups = new Backups(store);
  await backups.export(path);
  cache.publish([
    batch(id, { reportId: "revision", createTime: "2026-11-04T00:00:00Z" }, []),
  ]);
  expect(cache.read()[0].rows).toEqual([]);
  const preview = backups.inspect(path);
  await backups.restore(preview.previewId);
  expect(cache.read()[0].rows).toEqual(rows);
  expect(JSON.stringify(cache.read())).not.toContain("downloadUrl");
  store.close();
  store.open();
  expect(cache.read()[0].rows).toHaveLength(250);
});
it("scopes cache keys literally across channels and cancels after a channel switch", () => {
  const { store, id } = setup();
  const first = "UC" + "a".repeat(21) + "_",
    second = "UC" + "a".repeat(21) + "b";
  const a = new ReachCache(store, first),
    b = new ReachCache(store, second);
  a.publish([batch(id, { channelId: first })]);
  b.publish([batch(id, { channelId: second })]);
  expect(a.metadata()).toHaveLength(1);
  expect(b.metadata()).toHaveLength(1);
  store.create({ name: "Second channel" });
  expect(() => a.publish([])).toThrow("selected channel changed");
  expect(new ReachCache(store, first).read()).toEqual([]);
  store.select({ id });
  checkDatabase(store.db);
});
it("validates ownership, hashes, Pacific day boundaries and orphan chunks", () => {
  const { store, id, cache } = setup();
  const original = batch(id);
  cache.publish([original]);
  for (const value of [
    batch(id, { channelId: "UC9999999999999999999999" }),
    batch(id, { day: "2026-11-02" }),
    batch(id, { sha256: "a".repeat(64) }),
    batch(id, { startTime: "2026-11-01T08:00:00Z" }),
  ])
    expect(() => cache.publish([value])).toThrow();
  expect(() =>
    cache.publish(
      [batch(id, { reportId: "next", createTime: "2026-11-04T00:00:00Z" })],
      () => {
        throw new Error("cancelled");
      },
    ),
  ).toThrow();
  expect(cache.read()[0].metadata.reportId).toBe("report");
  store.db
    .prepare("INSERT INTO settings VALUES(?,?)")
    .run(`reach:${id}:${channel}:2026-11-01:99`, "[]");
  expect(() =>
    validateReachCache(store.db, store.state().workspaces),
  ).toThrow();
});
it("rolls back the entire batch when global cache capacity is exceeded", () => {
  const { id, cache } = setup();
  const original = batch(id);
  cache.publish([original]);
  const rows: ReachRow[] = Array.from({ length: 20000 }, (_, n) => [
    `vid${String(n).padStart(8, "0")}`,
    Number.MAX_SAFE_INTEGER,
    99.1234567890123,
  ]);
  const batches = Array.from({ length: 5 }, (_, n) => {
    const day = `2026-11-${String(n + 2).padStart(2, "0")}`,
      next = `2026-11-${String(n + 3).padStart(2, "0")}`;
    return batch(
      id,
      {
        day,
        startTime: day + "T08:00:00Z",
        endTime: next + "T08:00:00Z",
        reportId: `large-${n}`,
      },
      rows,
    );
  });
  expect(() => cache.publish(batches)).toThrow("4 MiB");
  expect(cache.read()).toEqual([original]);
});
it("runs list→download→parse→SQLite, skips replay and rolls back a malformed refresh", async () => {
  const { id, cache } = setup();
  let downloads = 0,
    revision = false,
    invalid = false;
  const metadata = {
    id: "report",
    jobId: "job",
    startTime: "2026-11-01T07:00:00Z",
    endTime: "2026-11-02T08:00:00Z",
    createTime: "2026-11-03T00:00:00Z",
    downloadUrl: "https://youtubereporting.googleapis.com/v1/media/reach",
  };
  const transport = async (raw: string) => {
    if (raw.includes("/reports"))
      return Response.json({
        reports: [
          revision
            ? { ...metadata, id: "revised", createTime: "2026-11-04T00:00:00Z" }
            : metadata,
        ],
      });
    downloads++;
    return new Response(
      invalid
        ? "bad data"
        : `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr\n20261101,${channel},abcdefghijk,1000,5`,
    );
  };
  expect(
    (await ingestReachReports("token", "job", id, channel, transport, cache))
      .updated,
  ).toBe(1);
  expect(
    (await ingestReachReports("token", "job", id, channel, transport, cache))
      .updated,
  ).toBe(0);
  expect(downloads).toBe(1);
  revision = true;
  invalid = true;
  await expect(
    ingestReachReports("token", "job", id, channel, transport, cache),
  ).rejects.toThrow();
  expect(cache.read()[0].metadata.reportId).toBe("report");
});

it("publishes multiple days atomically and keeps historical days after links expire", async () => {
  const { id, cache } = setup();
  cache.publish([batch(id)]);
  const first = {
    id: "next",
    jobId: "job",
    startTime: "2026-11-02T08:00:00Z",
    endTime: "2026-11-03T08:00:00Z",
    createTime: "2026-11-04T00:00:00Z",
    downloadUrl: "https://youtubereporting.googleapis.com/v1/media/good",
  };
  const second = {
    ...first,
    id: "bad",
    startTime: "2026-11-03T08:00:00Z",
    endTime: "2026-11-04T08:00:00Z",
    downloadUrl: "https://youtubereporting.googleapis.com/v1/media/bad",
  };
  await expect(
    ingestReachReports(
      "token",
      "job",
      id,
      channel,
      async (raw) =>
        raw.includes("/reports")
          ? Response.json({ reports: [first, second] })
          : new Response(
              raw.endsWith("good")
                ? `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr\n20261102,${channel},abcdefghijk,2000,6`
                : "invalid",
            ),
      cache,
    ),
  ).rejects.toThrow();
  expect(cache.read()).toHaveLength(1);
  const result = await ingestReachReports(
    "token",
    "job",
    id,
    channel,
    async () => Response.json({}),
    cache,
  );
  expect(result.state).toBe("waiting-for-reports");
  expect(cache.read()).toHaveLength(1);
});
