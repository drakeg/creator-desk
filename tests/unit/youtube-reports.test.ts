import { expect, it } from "vitest";
import { dailyReport, uploadReport } from "../../src/main/youtube/report-data";
import { dailySyncInput } from "../../src/shared/youtube";
const channel = "UC1234567890123456789012";
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
const range = { startDate: "2026-01-01", endDate: "2026-01-03" };
it("maps metric columns, converts minutes to hours, and discloses missing dates", async () => {
  const report = await dailyReport(
    "private",
    channel,
    range,
    async (raw, init) => {
      const url = new URL(raw);
      expect(url.origin).toBe("https://youtubeanalytics.googleapis.com");
      expect(url.searchParams.get("ids")).toBe(`channel==${channel}`);
      expect(init.headers).toEqual({ Authorization: "Bearer private" });
      return Response.json({
        columnHeaders: [headers[1], headers[0], ...headers.slice(2)],
        rows: [
          [10, "2026-01-01", 90, 1, 3],
          [20, "2026-01-03", 60, 5, 0],
        ],
      });
    },
  );
  expect(report.rows[0]).toMatchObject({
    watchHours: 1.5,
    subscribers: -2,
    impressions: null,
  });
  expect(report.rows).toHaveLength(2);
  expect(report.warnings.join(" ")).toContain("absent");
});
it("rejects duplicate, out-of-range and empty daily data", async () => {
  for (const rows of [
    [
      ["2026-01-01", 1, 1, 1, 1],
      ["2026-01-01", 1, 1, 1, 1],
    ],
    [["2025-12-31", 1, 1, 1, 1]],
    [],
  ]) {
    await expect(
      dailyReport("token", channel, range, async () =>
        Response.json({ columnHeaders: headers, rows }),
      ),
    ).rejects.toThrow();
  }
  expect(
    dailySyncInput.safeParse({ startDate: "2020-01-01", endDate: "2026-01-01" })
      .success,
  ).toBe(false);
});
it("follows upload pagination and omits unavailable video counts without inventing metrics", async () => {
  let pages = 0;
  const report = await uploadReport(
    "token",
    "UUplaylist",
    channel,
    async (raw) => {
      const url = new URL(raw);
      if (url.pathname.endsWith("playlistItems"))
        return Response.json({
          items: [
            {
              contentDetails: {
                videoId: ++pages === 1 ? "abcdefghijk" : "lmnopqrstuv",
              },
            },
          ],
          ...(pages === 1 ? { nextPageToken: "next" } : {}),
        });
      expect(url.searchParams.get("id")).toBe("abcdefghijk,lmnopqrstuv");
      return Response.json({
        items: [
          {
            id: "abcdefghijk",
            snippet: {
              channelId: channel,
              title: "A video",
              publishedAt: "2026-01-01T12:00:00Z",
            },
            statistics: { viewCount: "123" },
          },
          {
            id: "lmnopqrstuv",
            snippet: {
              channelId: channel,
              title: "Missing count",
              publishedAt: "2026-01-02T12:00:00Z",
            },
            statistics: {},
          },
        ],
      });
    },
  );
  expect(pages).toBe(2);
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0]).toMatchObject({
    views: 123,
    watchHours: null,
    date: null,
    published: "2026-01-01",
  });
  expect(report.warnings.join(" ")).toContain("omitted");
});
it("does not accept videos belonging to another channel", async () => {
  await expect(
    uploadReport("token", "playlist", channel, async (raw) =>
      raw.includes("playlistItems")
        ? Response.json({
            items: [{ contentDetails: { videoId: "abcdefghijk" } }],
          })
        : Response.json({
            items: [
              {
                id: "abcdefghijk",
                snippet: {
                  channelId: "other",
                  title: "wrong channel",
                  publishedAt: "2026-01-01T00:00:00Z",
                },
                statistics: { viewCount: "1" },
              },
            ],
          }),
    ),
  ).rejects.toThrow("invalid report");
});

it("discloses the upload cap when more playlist pages remain", async () => {
  let pages = 0;
  const report = await uploadReport(
    "fixture",
    "playlist",
    channel,
    async (raw) => {
      const url = new URL(raw);
      if (url.pathname.endsWith("playlistItems"))
        return Response.json({
          items: [
            {
              contentDetails: {
                videoId: ++pages === 1 ? "abcdefghijk" : "lmnopqrstuv",
              },
            },
          ],
          nextPageToken: `page${pages}`,
        });
      return Response.json({
        items: url.searchParams
          .get("id")!
          .split(",")
          .map((id) => ({
            id,
            snippet: {
              channelId: channel,
              title: id,
              publishedAt: "2026-01-01T00:00:00Z",
            },
            statistics: { viewCount: "1" },
          })),
      });
    },
  );
  expect(pages).toBe(2);
  expect(report.warnings.join(" ")).toContain("first 100 uploads");
});
