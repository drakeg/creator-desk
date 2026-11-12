import { describe, expect, it } from "vitest";
import { fetchVideoRetention } from "../../src/main/youtube/retention";
import type { Transport } from "../../src/main/youtube/http";

const query = {
  channelId: "UC" + "a".repeat(22),
  videoId: "abcdefghijk",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
};
const columns = [
  { name: "elapsedVideoTimeRatio" },
  { name: "audienceWatchRatio" },
  { name: "relativeRetentionPerformance" },
];
const response = (value: unknown) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});
describe("protected retention fetch", () => {
  it("verifies ownership then queries one video with correct dimensions", async () => {
    const calls: URL[] = [];
    const transport: Transport = async (url, init) => {
      const parsed = new URL(url);
      calls.push(parsed);
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
      if (calls.length === 1) return response({ items: [{ id: query.videoId, snippet: { channelId: query.channelId } }] });
      return response({ columnHeaders: columns, rows: [[0, 1.2, 0.8], [0.5, 0.6, 0.4]] });
    };
    const points = await fetchVideoRetention("token", query, transport);
    expect(points[0]?.audienceWatchRatio).toBe(1.2);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.searchParams.get("filters")).toBe("video==abcdefghijk");
    expect(calls[1]!.searchParams.get("dimensions")).toBe("elapsedVideoTimeRatio");
    expect(calls[1]!.searchParams.get("ids")).toBe(`channel==${query.channelId}`);
    expect(calls[1]!.searchParams.get("sort")).toBe("elapsedVideoTimeRatio");
  });
  it("refuses other channels without a retention request", async () => {
    let count = 0;
    const transport: Transport = async () => {
      count++;
      return response({ items: [{ id: query.videoId, snippet: { channelId: "UC" + "b".repeat(22) } }] });
    };
    await expect(fetchVideoRetention("token", query, transport)).rejects.toThrow(/does not belong/);
    expect(count).toBe(1);
  });
  it("keeps unavailable retention distinct from zero", async () => {
    let count = 0;
    const transport: Transport = async () => {
      count++;
      return response(count === 1 ? { items: [{ id: query.videoId, snippet: { channelId: query.channelId } }] } : { columnHeaders: columns });
    };
    expect(await fetchVideoRetention("token", query, transport)).toEqual([]);
  });
  it("rejects invalid report data and cross-video queries", async () => {
    let count = 0;
    const transport: Transport = async () => {
      count++;
      return response(count === 1 ? { items: [{ id: query.videoId, snippet: { channelId: query.channelId } }] } : { columnHeaders: columns, rows: [[0.9, -1, 0.3]] });
    };
    await expect(fetchVideoRetention("token", query, transport)).rejects.toThrow(/invalid retention/);
    await expect(fetchVideoRetention("token", { ...query, videoId: "abcdefghijk,other" }, transport)).rejects.toThrow();
    expect(count).toBe(2);
  });
  it("stops after ownership validation when aborted", async () => {
    const controller = new AbortController();
    let calls = 0;
    const transport: Transport = async () => {
      calls++;
      controller.abort();
      return response({ items: [{ id: query.videoId, snippet: { channelId: query.channelId } }] });
    };
    await expect(fetchVideoRetention("token", query, transport, controller.signal)).rejects.toThrow(/cancelled/);
    expect(calls).toBe(1);
  });
});
