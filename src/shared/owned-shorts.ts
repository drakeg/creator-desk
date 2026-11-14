import type { ChannelHistory, YouTubeState } from "./youtube";

/** Only uploads belonging to the current authenticated channel may be
 * suggested as a Shorts starting point. No public search or competitor videos.
 * This is metadata selection, not access to downloadable media bytes.
 */
export function ownedShortsUploads(
  youtube: YouTubeState | null,
  history: ChannelHistory | null,
): { id: string; title: string; durationSeconds: number | null }[] {
  if (!youtube?.connected || !youtube.snapshot || !history ||
    history.channelId !== youtube.snapshot.id ||
    history.uploads?.kind !== "videos") return [];
  return history.uploads.rows
    .filter((row) => /^[a-zA-Z0-9_-]{11}$/.test(row.id))
    .map((row) => ({
      id: row.id,
      title: row.title,
      durationSeconds: row.durationSeconds ?? null,
    }));
}
