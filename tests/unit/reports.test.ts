import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { Reports } from "../../src/main/imports/reports";
import { Backups } from "../../src/main/storage/backups";
const roots: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  stores.forEach((s) => s.close());
  roots.forEach((r) => rmSync(r, { recursive: true, force: true }));
  roots.length = stores.length = 0;
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "reports-"));
  roots.push(root);
  const store = new Store(root);
  stores.push(store);
  store.create({ name: "Channel" });
  const reports = new Reports(store);
  const path = join(root, "videos.csv");
  writeFileSync(path, readFileSync("tests/fixtures/videos.csv"));
  return { root, store, reports, path };
}
const metadata = {
  channelName: "Our channel",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-28",
  periodUnknown: false,
};
it("previews without saving, deduplicates commits and persists reports", () => {
  const { root, store, reports, path } = setup();
  const preview = reports.inspect(path);
  expect(reports.dashboard({}).reports).toEqual([]);
  const first = reports.commit({ ...metadata, previewId: preview.previewId });
  expect(first.duplicate).toBe(false);
  const again = reports.inspect(path);
  expect(
    reports.commit({ ...metadata, previewId: again.previewId }),
  ).toMatchObject({ reportId: first.reportId, duplicate: true });
  store.close();
  const reopened = new Store(root);
  stores.push(reopened);
  expect(new Reports(reopened).dashboard({}).totals).toMatchObject({
    views: 1500,
    watchHours: 125.5,
    subscribers: 8,
  });
});
it("keeps overlapping snapshots separate, supports sorting/search and isolates workspaces", () => {
  const { store, reports, path } = setup();
  let p = reports.inspect(path);
  const first = reports.commit({ ...metadata, previewId: p.previewId });
  p = reports.inspect(path);
  reports.commit({
    ...metadata,
    periodStart: "2026-10-02",
    previewId: p.previewId,
  });
  const d = reports.dashboard({
    reportId: first.reportId,
    sort: "views",
    direction: "asc",
  });
  expect(d.reports).toHaveLength(2);
  expect(d.totals.views).toBe(1500);
  expect(d.rows[0].views).toBe(500);
  expect(
    reports.dashboard({ reportId: first.reportId, search: "waterfall" })
      .rowCount,
  ).toBe(1);
  store.create({ name: "Other" });
  expect(reports.dashboard({}).reports).toEqual([]);
  expect(() => reports.dashboard({ reportId: first.reportId })).toThrow();
});
it("filters daily dates but rejects slicing video period totals", () => {
  const { reports, path } = setup();
  let p = reports.inspect(path);
  const video = reports.commit({ ...metadata, previewId: p.previewId });
  expect(() =>
    reports.dashboard({ reportId: video.reportId, startDate: "2026-10-02" }),
  ).toThrow();
  writeFileSync(path, readFileSync("tests/fixtures/daily.csv"));
  p = reports.inspect(path);
  const daily = reports.commit({
    ...metadata,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    previewId: p.previewId,
  });
  const d = reports.dashboard({
    reportId: daily.reportId,
    startDate: "2026-10-02",
    endDate: "2026-10-03",
  });
  expect(d.totals).toMatchObject({
    views: 250,
    watchHours: 12,
    subscribers: 3,
    impressions: null,
  });
  expect(d.series).toHaveLength(2);
  expect(
    reports.dashboard({ reportId: daily.reportId, startDate: "2027-01-01" })
      .totals.views,
  ).toBeNull();
});
it("rejects cancelled, expired or workspace-switched previews", () => {
  const { store, reports, path } = setup();
  let p = reports.inspect(path);
  reports.cancel();
  expect(() =>
    reports.commit({ ...metadata, previewId: p.previewId }),
  ).toThrow();
  p = reports.inspect(path);
  expect(() =>
    reports.commit(
      { ...metadata, previewId: p.previewId },
      Date.now() + 16 * 60_000,
    ),
  ).toThrow();
  p = reports.inspect(path);
  store.create({ name: "Other" });
  expect(() =>
    reports.commit({ ...metadata, previewId: p.previewId }),
  ).toThrow();
  expect(reports.dashboard({}).reports).toEqual([]);
});
it("includes imported rows in backup/restore", async () => {
  const { root, reports, path, store } = setup();
  const p = reports.inspect(path);
  reports.commit({ ...metadata, previewId: p.previewId });
  const backups = new Backups(store);
  const file = join(root, "reports.creatorbackup");
  await backups.export(file);
  store.create({ name: "Other" });
  const preview = backups.inspect(file);
  await backups.restore(preview.previewId);
  expect(reports.dashboard({}).totals.views).toBe(1500);
});

it("treats reordered identical rows as the same snapshot", () => {
  const { reports, path } = setup();
  const first = reports.inspect(path);
  const saved = reports.commit({ ...metadata, previewId: first.previewId });
  const lines = readFileSync("tests/fixtures/videos.csv", "utf8")
    .trimEnd()
    .split("\n");
  writeFileSync(path, [lines[0], lines[1], lines[3], lines[2]].join("\n"));
  const second = reports.inspect(path);
  expect(
    reports.commit({ ...metadata, previewId: second.previewId }),
  ).toMatchObject({ reportId: saved.reportId, duplicate: true });
});
it("paginates large libraries without losing the filtered totals", () => {
  const { reports, path } = setup();
  writeFileSync(
    path,
    "Content,Video title,Views\n" +
      Array.from({ length: 27 }, (_, i) => `id${i},Video ${i},${i}`).join("\n"),
  );
  const p = reports.inspect(path);
  reports.commit({ ...metadata, previewId: p.previewId });
  const result = reports.dashboard({ page: 2 });
  expect(result.rows).toHaveLength(2);
  expect(result.rowCount).toBe(27);
  expect(result.totals.views).toBe(351);
  expect(result.pageCount).toBe(2);
});
