import { describe, expect, it } from "vitest";
import { parseRetentionResponse, retentionQuery } from "../../src/shared/retention";

const columnHeaders = [
  { name: "elapsedVideoTimeRatio" },
  { name: "audienceWatchRatio" },
  { name: "relativeRetentionPerformance" },
];
describe("retention report contracts", () => {
  it("preserves replayed segments above a 1.0 watch ratio", () => {
    expect(parseRetentionResponse({
      columnHeaders,
      rows: [[0, 1.4, 0.8], [0.5, 0.65, 0.4], [1, 0.2, 0.3]],
    })).toHaveLength(3);
    expect(parseRetentionResponse({ columnHeaders, rows: [[0, 1.4, 0.8]] })[0].audienceWatchRatio).toBe(1.4);
  });

  it("preserves no-data reports as empty, not as a fabricated zero curve", () => {
    expect(parseRetentionResponse({ columnHeaders })).toEqual([]);
  });

  it("rejects reordered columns, unsorted positions and repeated points", () => {
    expect(() => parseRetentionResponse({ columnHeaders: [...columnHeaders].reverse(), rows: [] })).toThrow();
    expect(() => parseRetentionResponse({ columnHeaders, rows: [[0.5, 1, 0.5], [0.4, 1, 0.5]] })).toThrow();
    expect(() => parseRetentionResponse({ columnHeaders, rows: [[0.5, 1, 0.5], [0.5, 1, 0.5]] })).toThrow();
  });

  it("rejects invalid numeric data rather than coercing or clamping", () => {
    for (const row of [[-0.1, 1, 0.5], [1.1, 1, 0.5], [0, -1, 0.5], [0, 1, 1.1], [0, "1", 0.5], [0, Number.NaN, 0.5]]) {
      expect(() => parseRetentionResponse({ columnHeaders, rows: [row] })).toThrow();
    }
  });

  it("restricts requests to a single video, one channel and valid date range", () => {
    const base = { channelId: "UC" + "a".repeat(22), videoId: "abcdefghijk", startDate: "2026-10-01", endDate: "2026-10-31" };
    expect(retentionQuery.parse(base)).toEqual(base);
    expect(retentionQuery.safeParse({ ...base, videoId: "abcdefghijk,other" }).success).toBe(false);
    expect(retentionQuery.safeParse({ ...base, startDate: "2026-11-01" }).success).toBe(false);
  });
});
