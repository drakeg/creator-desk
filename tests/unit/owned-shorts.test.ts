import { describe, expect, it } from "vitest";
import { ownedShortsUploads } from "../../src/shared/owned-shorts";
import type { ChannelHistory, YouTubeState } from "../../src/shared/youtube";

const channel = "UC1234567890123456789012";
const state: YouTubeState = {
  configured: true, clientSource: "custom", appClientAvailable: false,
  connected: true, pending: false, error: null,
  snapshot: {
    id: channel, title: "My own channel",
    views: 10, subscribers: 5, videos: 2, syncedAt: "2026-11-13T01:00:00Z",
  },
};
const history: ChannelHistory = {
  channelId: channel, startDate: "2026-01-01", endDate: "2026-11-12",
  syncedAt: "2026-11-13T01:00:00Z", dailyId: null, uploadsId: null,
  daily: null,
  uploads: {
    kind: "videos",
    metrics: ["views"],
    warnings: [],
    rows: [{
      id: "abcdefghijk", title: "My published upload",
      date: null, published: "2026-11-01", views: 10, watchHours: 2,
      subscribers: null, impressions: null, durationSeconds: 100,
    }, {
      id: "invalid", title: "Bad video identifier",
      date: null, published: null, views: 0, watchHours: null,
      subscribers: null, impressions: null,
    }],
  },
};

describe("owner-only Shorts source selection", () => {
  it("shows only metadata of videos synced from the authenticated channel", () => {
    expect(ownedShortsUploads(state, history)).toEqual([
      { id: "abcdefghijk", title: "My published upload", durationSeconds: 100 },
    ]);
  });
  it("never exposes another channel's upload history", () => {
    expect(ownedShortsUploads(state, { ...history, channelId: "UC0000000000000000000000" }))
      .toEqual([]);
    expect(ownedShortsUploads({ ...state, connected: false }, history)).toEqual([]);
    expect(ownedShortsUploads({ ...state, snapshot: null }, history)).toEqual([]);
    expect(ownedShortsUploads(null, history)).toEqual([]);
  });
  it("handles missing and unavailable uploaded-video metadata", () => {
    expect(ownedShortsUploads(state, null)).toEqual([]);
    expect(ownedShortsUploads(state, { ...history, uploads: null })).toEqual([]);
    const updated: ChannelHistory = {
      ...history,
      uploads: { ...history.uploads!, rows: [{ ...history.uploads!.rows[0]!, durationSeconds: null }] },
    };
    expect(ownedShortsUploads(state, updated)[0]?.durationSeconds).toBeNull();
  });
});
