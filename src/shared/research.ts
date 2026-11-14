import { z } from "zod";

export const researchInput = z.object({
  query: z.string().trim().min(2).max(100),
}).strict();

export const researchVideo = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  title: z.string().min(1).max(500),
  channelId: z.string().regex(/^UC[a-zA-Z0-9_-]{22}$/),
  channelTitle: z.string().min(1).max(250),
  publishedAt: z.iso.datetime({ offset: true }),
  views: z.number().int().nonnegative().nullable(),
}).strict();

export const researchResults = z.object({
  query: z.string().min(2).max(100),
  fetchedAt: z.iso.datetime(),
  videos: z.array(researchVideo).max(10),
  queriesRemainingToday: z.number().int().min(0).max(20),
}).strict();
export type ResearchResults = z.infer<typeof researchResults>;

/** Search metadata is for discovery. This does not grant access to video files. */
export const searchResponse = z.object({
  items: z.array(z.object({
    id: z.object({ videoId: researchVideo.shape.id }),
    snippet: z.object({
      title: z.string().min(1).max(500),
      channelId: researchVideo.shape.channelId,
      channelTitle: z.string().min(1).max(250),
      publishedAt: researchVideo.shape.publishedAt,
    }),
  })).max(10),
}).passthrough();

export const videosResponse = z.object({
  items: z.array(z.object({
    id: researchVideo.shape.id,
    statistics: z.object({
      viewCount: z.string().regex(/^\d+$/).optional(),
    }).optional(),
  })).max(10),
}).passthrough();

export function combineResearchResults(
  query: string,
  search: z.infer<typeof searchResponse>,
  details: z.infer<typeof videosResponse>,
  fetchedAt: string,
  queriesRemainingToday: number,
): ResearchResults {
  const counts = new Map(details.items.map((item) => [
    item.id,
    item.statistics?.viewCount === undefined ? null : Number(item.statistics.viewCount),
  ]));
  return researchResults.parse({
    query, fetchedAt, queriesRemainingToday,
    videos: search.items.map((item) => {
      const value = counts.get(item.id.videoId);
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        views: value !== undefined && value !== null && Number.isSafeInteger(value) ? value : null,
      };
    }),
  });
}
