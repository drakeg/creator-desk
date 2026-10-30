import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import {
  parsedReport,
  dateOnly,
  type ParsedReport,
} from "../../shared/analytics";
import { dailySyncInput, type DailySyncInput } from "../../shared/youtube";
import { googleJSON, type Transport } from "./http";
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const numeric = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER);
const apiCount = z.string().regex(/^\d+$/).transform(Number).pipe(integer);
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
function invalid(): never {
  throw new CoreError(
    "REMOTE_ERROR",
    "YouTube returned invalid report data. Existing reports are preserved.",
  );
}
function empty(): never {
  throw new CoreError(
    "REMOTE_ERROR",
    "YouTube returned no report rows. Try an earlier date range or check that this channel has published videos. Existing reports are preserved.",
  );
}
export async function dailyReport(
  token: string,
  channelId: string,
  input: DailySyncInput,
  transport: Transport,
): Promise<ParsedReport> {
  const range = dailySyncInput.parse(input);
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  const names = [
    "day",
    "views",
    "estimatedMinutesWatched",
    "subscribersGained",
    "subscribersLost",
  ];
  url.search = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: "day",
    metrics: names.slice(1).join(","),
    sort: "day",
    maxResults: "366",
  }).toString();
  const parsed = z
    .object({
      columnHeaders: z
        .array(
          z.object({
            name: z.string(),
            columnType: z.string(),
            dataType: z.string(),
          }),
        )
        .length(5),
      rows: z.array(z.array(z.unknown()).length(5)).max(366).optional(),
    })
    .safeParse(
      await googleJSON(
        url.href,
        { headers: { Authorization: `Bearer ${token}` } },
        transport,
      ),
    );
  if (!parsed.success) invalid();
  const raw = parsed.data;
  const indices = names.map((name) =>
    raw.columnHeaders.findIndex((h) => h.name === name),
  );
  if (
    new Set(indices).size !== 5 ||
    indices.includes(-1) ||
    raw.columnHeaders[indices[0]!]!.columnType !== "DIMENSION" ||
    indices.slice(1).some((i) => raw.columnHeaders[i]!.columnType !== "METRIC")
  )
    invalid();
  if (!raw.rows?.length) empty();
  const rows = raw.rows
    .map((values) => {
      const day = dateOnly.safeParse(values[indices[0]!]);
      const views = integer.safeParse(values[indices[1]!]);
      const minutes = numeric.safeParse(values[indices[2]!]);
      const gained = integer.safeParse(values[indices[3]!]);
      const lost = integer.safeParse(values[indices[4]!]);
      if (
        !day.success ||
        !views.success ||
        !minutes.success ||
        !gained.success ||
        !lost.success ||
        day.data < range.startDate ||
        day.data > range.endDate
      )
        invalid();
      return {
        id: day.data,
        title: day.data,
        date: day.data,
        published: null,
        views: views.data,
        watchHours: minutes.data / 60,
        subscribers: gained.data - lost.data,
        impressions: null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(rows.map((r) => r.id)).size !== rows.length) invalid();
  const expected =
    (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000 + 1;
  return parsedReport.parse({
    kind: "daily",
    rows,
    metrics: ["views", "watchHours", "subscribers"],
    warnings: [
      `YouTube Analytics snapshot requested for ${range.startDate} to ${range.endDate}. Dates use YouTube's reporting time zone. Only returned dates are included; missing dates are not filled with zero.`,
      ...(rows.length < expected
        ? [
            "Some requested dates are absent. Recent metrics may be delayed or no activity was returned for those dates.",
          ]
        : []),
    ],
  });
}
export async function uploadReport(
  token: string,
  playlistId: string,
  channelId: string,
  transport: Transport,
): Promise<ParsedReport> {
  const headers = { Authorization: `Bearer ${token}` };
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 2; page++) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.search = new URLSearchParams({
      part: "contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const result = z
      .object({
        items: z
          .array(z.object({ contentDetails: z.object({ videoId }) }))
          .max(50),
        nextPageToken: z.string().min(1).max(1000).optional(),
      })
      .safeParse(await googleJSON(url.href, { headers }, transport));
    if (!result.success) invalid();
    ids.push(...result.data.items.map((i) => i.contentDetails.videoId));
    pageToken = result.data.nextPageToken;
    if (!pageToken) break;
  }
  const unique = [...new Set(ids)];
  const rows: ParsedReport["rows"] = [];
  for (let offset = 0; offset < unique.length; offset += 50) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    const batch = unique.slice(offset, offset + 50);
    url.search = new URLSearchParams({
      part: "snippet,statistics",
      id: batch.join(","),
    }).toString();
    const result = z
      .object({
        items: z
          .array(
            z.object({
              id: videoId,
              snippet: z.object({
                channelId: z.string(),
                title: z.string().min(1).max(1000),
                publishedAt: z.iso.datetime({ offset: true }),
              }),
              statistics: z.object({ viewCount: apiCount.optional() }),
            }),
          )
          .max(50),
      })
      .safeParse(await googleJSON(url.href, { headers }, transport));
    if (!result.success) invalid();
    for (const item of result.data.items) {
      if (!batch.includes(item.id) || item.snippet.channelId !== channelId)
        invalid();
      if (item.statistics.viewCount === undefined) continue;
      rows.push({
        id: item.id,
        title: item.snippet.title,
        date: null,
        published: item.snippet.publishedAt.slice(0, 10),
        views: item.statistics.viewCount,
        watchHours: null,
        subscribers: null,
        impressions: null,
      });
    }
  }
  if (!rows.length) empty();
  if (new Set(rows.map((r) => r.id)).size !== rows.length) invalid();
  return parsedReport.parse({
    kind: "videos",
    rows,
    metrics: ["views"],
    warnings: [
      "YouTube Data API upload snapshot: cumulative views for returned videos, not views in a chosen reporting period. Watch time, subscriber change, and impressions are unavailable.",
      ...(pageToken
        ? [
            "Limited to the first 100 uploads returned by YouTube. More uploads exist.",
          ]
        : []),
      ...(rows.length < unique.length
        ? [
            "Some listed videos were unavailable or lacked view counts and were omitted.",
          ]
        : []),
    ],
  });
}
