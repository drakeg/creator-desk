import { describe, expect, it } from "vitest";
import {
  researchInput, searchResponse, videosResponse,
  combineResearchResults,
} from "../../src/shared/research";

const item = {
  id: { videoId: "abcdefghijk" },
  snippet: {
    title: "Original RV solar video",
    channelId: "UC1234567890123456789012",
    channelTitle: "RV creator",
    publishedAt: "2026-11-01T00:00:00Z",
  },
};
describe("source-backed YouTube topic research", () => {
  it("only accepts bounded nonempty queries", () => {
    expect(researchInput.safeParse({ query: "  RV solar  " }).success).toBe(true);
    expect(researchInput.safeParse({ query: "x" }).success).toBe(false);
    expect(researchInput.safeParse({ query: "x".repeat(101) }).success).toBe(false);
    expect(researchInput.safeParse({ query: "RV", extra: "unsafe" }).success).toBe(false);
  });
  it("shows sourced public results without inventing views or search volume", () => {
    const search = searchResponse.parse({ items: [item] });
    const details = videosResponse.parse({ items: [{ id: "abcdefghijk", statistics: {} }] });
    const results = combineResearchResults("RV solar", search, details,
      "2026-11-14T00:00:00Z", 19);
    expect(results.videos).toEqual([{
      id: "abcdefghijk", title: "Original RV solar video",
      channelId: "UC1234567890123456789012", channelTitle: "RV creator",
      publishedAt: "2026-11-01T00:00:00Z", views: null,
    }]);
    expect(Object.hasOwn(results, "searchVolume")).toBe(false);
  });
  it("keeps observed zero distinct from unavailable view counts", () => {
    const s = searchResponse.parse({ items: [item] });
    expect(combineResearchResults("RV", s,
      videosResponse.parse({ items: [{ id: "abcdefghijk", statistics: { viewCount: "0" } }] }),
      "2026-11-14T00:00:00Z", 0).videos[0]?.views).toBe(0);
    expect(combineResearchResults("RV", s,
      videosResponse.parse({ items: [] }),
      "2026-11-14T00:00:00Z", 0).videos[0]?.views).toBeNull();
  });
  it("rejects invalid YouTube identifiers and oversized result sets", () => {
    expect(searchResponse.safeParse({ items: [{ ...item, id: { videoId: "bad" } }] }).success).toBe(false);
    expect(searchResponse.safeParse({ items: Array(11).fill(item) }).success).toBe(false);
    expect(videosResponse.safeParse({ items: [{ id: "abcdefghijk", statistics: { viewCount: "-5" } }] }).success).toBe(false);
  });
});
