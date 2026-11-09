import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { History, historicalDaily } from "../../src/main/youtube/history";
import { uploadReport } from "../../src/main/youtube/report-data";
import { checkDatabase } from "../../src/main/storage/schema";
import type { ParsedReport } from "../../src/shared/analytics";
const channelId = "UC1234567890123456789012";
const headers = [
  "day",
  "views",
  "estimatedMinutesWatched",
  "subscribersGained",
  "subscribersLost",
].map((name, i) => ({
  name,
  columnType: i ? "METRIC" : "DIMENSION",
  dataType: i ? "INTEGER" : "STRING",
}));
const stores: Store[] = [];
afterEach(() => {
  for (const store of stores) {
    store.close();
    rmSync(store.root, { recursive: true, force: true });
  }
});
it("backfills nonoverlapping windows including empty years and leap days", async () => {
  const ranges: string[][] = [];
  const result = await historicalDaily(
    "token",
    channelId,
    "2023-01-01",
    "2025-01-03",
    async (raw) => {
      const url = new URL(raw),
        start = url.searchParams.get("startDate")!,
        end = url.searchParams.get("endDate")!;
      ranges.push([start, end]);
      return Response.json({
        columnHeaders: headers,
        rows: start === "2023-01-01" ? [] : [[start, 10, 60, 2, 1]],
      });
    },
    () => {},
  );
  expect(ranges).toEqual([
    ["2023-01-01", "2024-01-01"],
    ["2024-01-02", "2025-01-01"],
    ["2025-01-02", "2025-01-03"],
  ]);
  expect(result?.rows.map((r) => r.id)).toEqual(["2024-01-02", "2025-01-02"]);
  expect(result?.rows[0].watchHours).toBe(1);
});
it("accepts an empty history without fabricating activity", async () => {
  expect(
    await historicalDaily(
      "token",
      channelId,
      "2026-01-01",
      "2026-01-02",
      async () => Response.json({ columnHeaders: headers }),
      () => {},
    ),
  ).toBe(null);
});
it("rejects a repeated playlist page token", async () => {
  await expect(
    uploadReport(
      "token",
      "playlist",
      channelId,
      async () => Response.json({ items: [], nextPageToken: "repeated" }),
      true,
    ),
  ).rejects.toThrow("invalid report");
});
it("replaces managed history atomically, survives reopen and scopes reads to a channel", () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "channel-history-")));
  stores.push(store);
  const workspace = store.create({ name: "First" }),
    history = new History(store);
  const daily: ParsedReport = {
    kind: "daily",
    rows: [
      {
        id: "2026-01-01",
        title: "2026-01-01",
        date: "2026-01-01",
        published: null,
        views: 10,
        watchHours: 1,
        subscribers: 2,
        impressions: null,
      },
    ],
    metrics: ["views", "watchHours", "subscribers"],
    warnings: [],
  };
  history.save(
    workspace.id,
    channelId,
    "First",
    "2025-01-01",
    "2026-01-01",
    daily,
    null,
  );
  history.save(
    workspace.id,
    channelId,
    "First",
    "2025-01-01",
    "2026-01-01",
    daily,
    null,
  );
  expect(store.db.prepare("SELECT COUNT(*) AS n FROM reports").get()?.n).toBe(
    1,
  );
  expect(() =>
    history.save(
      workspace.id,
      channelId,
      "First",
      "bad",
      "2026-01-01",
      daily,
      null,
    ),
  ).toThrow();
  expect(history.load(workspace.id)?.daily?.rows[0].views).toBe(10);
  checkDatabase(store.db);
  store.close();
  store.open();
  expect(history.load(workspace.id)?.daily?.rows).toHaveLength(1);
  const other = store.create({ name: "Other" });
  expect(history.load(other.id)).toBe(null);
});

it("includes history in database backups without exposing it as an imported snapshot", async () => {
  const { Backups } = await import("../../src/main/storage/backups");
  const { Reports } = await import("../../src/main/imports/reports");
  const store = new Store(mkdtempSync(join(tmpdir(), "history-backup-")));
  stores.push(store);
  const area = store.create({ name: "Channel" }),
    history = new History(store);
  const daily: ParsedReport = {
    kind: "daily",
    rows: [
      {
        id: "2026-01-01",
        title: "2026-01-01",
        date: "2026-01-01",
        published: null,
        views: 8,
        watchHours: 1,
        subscribers: 1,
        impressions: null,
      },
    ],
    metrics: ["views", "watchHours", "subscribers"],
    warnings: [],
  };
  const original = history.save(
    area.id,
    channelId,
    "Channel",
    "2026-01-01",
    "2026-01-01",
    daily,
    null,
  );
  const reports = new Reports(store);
  expect(reports.dashboard({}).reports).toHaveLength(0);
  expect(() =>
    reports.manage({ reportId: original.dailyId, action: "delete" }),
  ).toThrow("maintained");
  const backups = new Backups(store),
    path = join(store.root, "history.creatorbackup");
  await backups.export(path);
  history.save(
    area.id,
    channelId,
    "Channel",
    "2026-01-01",
    "2026-01-01",
    null,
    null,
  );
  const preview = backups.inspect(path);
  await backups.restore(preview.previewId);
  expect(history.load(area.id)).toEqual(original);
});
