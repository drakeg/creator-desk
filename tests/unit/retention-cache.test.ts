import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { Backups } from "../../src/main/storage/backups";
import { checkDatabase } from "../../src/main/storage/schema";
import { RetentionCache } from "../../src/main/youtube/retention-cache";

const stores: Store[] = [];
const channelId = "UC" + "a".repeat(22);
const query = { channelId, videoId: "abcdefghijk", startDate: "2026-10-01", endDate: "2026-10-31" };
const points = [{ elapsedVideoTimeRatio: 0, audienceWatchRatio: 1.4, relativeRetentionPerformance: 0.8 }];
function make() {
  const store = new Store(mkdtempSync(join(tmpdir(), "retention-cache-")));
  stores.push(store);
  const first = store.create({ name: "One" });
  return { store, first, cache: new RetentionCache(store) };
}
afterEach(() => {
  for (const s of stores) {
    s.close();
    rmSync(s.root, { recursive: true, force: true });
  }
  stores.length = 0;
});
describe("retention SQLite cache", () => {
  it("stores replay ratios and empty-but-successful curves separately from missing", () => {
    const { store, cache } = make();
    expect(cache.read(query)).toBeNull();
    cache.save(query, points);
    expect(cache.read(query)?.points[0]?.audienceWatchRatio).toBe(1.4);
    const other = { ...query, videoId: "another1234" };
    cache.save(other, []);
    expect(cache.read(other)?.points).toEqual([]);
    expect(cache.read({ ...query, startDate: "2026-09-01" })).toBeNull();
    checkDatabase(store.db);
  });
  it("isolates channel, workspace, and selection changes", () => {
    const { store, first, cache } = make();
    cache.save(query, points);
    expect(cache.read({ ...query, channelId: "UC" + "b".repeat(22) })).toBeNull();
    store.create({ name: "Two" });
    expect(() => cache.save(query, points)).toThrow(/channel changed/);
    expect(new RetentionCache(store).read(query)).toBeNull();
    store.select({ id: first.id });
    expect(cache.read(query)?.points).toEqual(points);
  });
  it("rolls back invalid curves and cancelled publication", () => {
    const { cache } = make();
    cache.save(query, points);
    expect(() => cache.save(query, [{...points[0], audienceWatchRatio: -1}])).toThrow();
    expect(() => cache.save(query, points, () => {throw Error("cancelled");})).toThrow();
    expect(cache.read(query)?.points).toEqual(points);
  });
  it("persists in backups and fails closed on modified records", async () => {
    const { store, cache } = make();
    cache.save(query, points);
    const backups = new Backups(store);
    const path = join(store.root, "retention.creatorbackup");
    await backups.export(path);
    cache.save(query, []);
    const preview = backups.inspect(path);
    await backups.restore(preview.previewId);
    expect(cache.read(query)?.points).toEqual(points);
    store.close();
    store.open();
    expect(cache.read(query)?.points).toEqual(points);
    store.db.prepare("UPDATE settings SET value=? WHERE key LIKE 'retention:%'").run('{"tampered":true}');
    expect(() => checkDatabase(store.db)).toThrow();
  });
});
