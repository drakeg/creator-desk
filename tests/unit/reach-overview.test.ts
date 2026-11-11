import { expect, it } from "vitest";
import { reachTotals } from "../../src/main/youtube/reach-overview";
it("weights CTR by impressions in provider percentage units", () => {
  expect(
    reachTotals([
      ["abcdefghijk", 100, 10],
      ["lmnopqrstuv", 900, 2],
    ]),
  ).toEqual({ impressions: 1000, ctr: 2.8 });
  expect(reachTotals([["abcdefghijk", 100, 0.05]])).toEqual({
    impressions: 100,
    ctr: 0.05,
  });
});
it("keeps missing denominators, absent rows and incomplete CTR unavailable", () => {
  expect(reachTotals([])).toEqual({ impressions: null, ctr: null });
  expect(reachTotals([[null, 0, 0]])).toEqual({ impressions: 0, ctr: null });
  expect(
    reachTotals([
      [null, 10, null],
      ["abcdefghijk", 10, 2],
    ]),
  ).toEqual({ impressions: 20, ctr: null });
  expect(
    reachTotals([
      [null, 0, null],
      ["abcdefghijk", 10, 2],
    ]),
  ).toEqual({ impressions: 10, ctr: 2 });
  expect(
    reachTotals([
      [null, Number.MAX_SAFE_INTEGER, 2],
      ["abcdefghijk", 1, 2],
    ]),
  ).toEqual({ impressions: null, ctr: null });
});

it("filters saved days/videos, retains explicit coverage and keeps channel totals scoped", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs"),
    { tmpdir } = await import("node:os"),
    { join } = await import("node:path");
  const { Store } = await import("../../src/main/storage/store"),
    { ReachCache, reachHash } =
      await import("../../src/main/youtube/reach-cache"),
    { readReachOverview } =
      await import("../../src/main/youtube/reach-overview");
  const store = new Store(mkdtempSync(join(tmpdir(), "reach-view-")));
  const area = store.create({ name: "One" }),
    channel = "UC1234567890123456789012";
  try {
    const rows: import("../../src/shared/reach").ReachRow[] = [
      ["abcdefghijk", 100, 10],
      ["lmnopqrstuv", 900, 2],
      [null, 0, null],
    ];
    new ReachCache(store, channel).publish([
      {
        metadata: {
          workspaceId: area.id,
          channelId: channel,
          jobId: "job",
          reportId: "one",
          day: "2026-11-01",
          startTime: "2026-11-01T07:00:00Z",
          endTime: "2026-11-02T08:00:00Z",
          createTime: "2026-11-03T00:00:00Z",
          downloadedAt: "2026-11-04T00:00:00Z",
          rowCount: rows.length,
          parts: 1,
          sha256: reachHash(rows),
        },
        rows,
      },
    ]);
    expect(readReachOverview(store, channel, {})).toMatchObject({
      impressions: 1000,
      ctr: 2.8,
      coveredDays: ["2026-11-01"],
      selectedDays: 1,
    });
    expect(
      readReachOverview(store, channel, { videoId: "abcdefghijk" }),
    ).toMatchObject({ impressions: 100, ctr: 10 });
    expect(
      readReachOverview(store, channel, { startDate: "2026-12-01" }),
    ).toMatchObject({ impressions: null, ctr: null, selectedDays: 0 });
    expect(
      readReachOverview(store, channel, { videoId: "unassigned" }),
    ).toMatchObject({ impressions: 0, ctr: null });
    store.create({ name: "Other" });
    expect(readReachOverview(store, channel, {}).coveredDays).toEqual([]);
  } finally {
    store.close();
    rmSync(store.root, { recursive: true, force: true });
  }
});
