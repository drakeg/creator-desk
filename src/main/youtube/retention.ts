import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import {
  retentionQuery,
  parseRetentionResponse,
  type RetentionQuery,
  type RetentionPoint,
} from "../../shared/retention";
import { googleJSON, type Transport } from "./http";

const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const channelId = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);

/**
 * Fetch a single owned video's retention curve using the existing protected
 * Google transport. Credentials stay in main-process memory.
 * Caller must supply the currently authorized channel and abort operation
 * if the workspace/account selection changes.
 */
export async function fetchVideoRetention(
  token: string,
  query: RetentionQuery,
  transport: Transport = fetch,
  signal?: AbortSignal,
): Promise<RetentionPoint[]> {
  const input = retentionQuery.parse(query);
  if (!token) throw new CoreError("INVALID_INPUT", "Connect YouTube first.");
  const headers = { Authorization: `Bearer ${token}` };
  const videoUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videoUrl.search = new URLSearchParams({
    part: "snippet",
    id: input.videoId,
    maxResults: "1",
  }).toString();
  const video = z.object({
    items: z.array(z.object({
      id: videoId,
      snippet: z.object({ channelId }),
    })).max(1),
  }).safeParse(await googleJSON(videoUrl.href, { headers, signal }, transport));
  if (!video.success) {
    throw new CoreError("REMOTE_ERROR", "YouTube returned invalid video ownership information.");
  }
  if (
    video.data.items.length !== 1 ||
    video.data.items[0]!.id !== input.videoId ||
    video.data.items[0]!.snippet.channelId !== input.channelId
  ) {
    throw new CoreError("NOT_FOUND", "This video is unavailable or does not belong to the selected channel.");
  }
  if (signal?.aborted) {
    throw new CoreError("CANCELLED", "Retention refresh was cancelled.");
  }
  const reportUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  reportUrl.search = new URLSearchParams({
    ids: `channel==${input.channelId}`,
    startDate: input.startDate,
    endDate: input.endDate,
    dimensions: "elapsedVideoTimeRatio",
    metrics: "audienceWatchRatio,relativeRetentionPerformance",
    filters: `video==${input.videoId}`,
    sort: "elapsedVideoTimeRatio",
    maxResults: "200",
  }).toString();
  const raw = await googleJSON(reportUrl.href, { headers, signal }, transport);
  if (signal?.aborted) {
    throw new CoreError("CANCELLED", "Retention refresh was cancelled.");
  }
  try {
    return parseRetentionResponse(raw);
  } catch {
    throw new CoreError("REMOTE_ERROR", "YouTube returned invalid retention data. Previous history is unchanged.");
  }
}
