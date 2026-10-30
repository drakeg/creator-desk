import { z } from "zod";
export const channelSnapshot = z
  .object({
    id: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
    title: z.string().min(1).max(200),
    views: z.number().int().nonnegative().nullable(),
    subscribers: z.number().int().nonnegative().nullable(),
    videos: z.number().int().nonnegative().nullable(),
    syncedAt: z.iso.datetime(),
  })
  .strict();
export type ChannelSnapshot = z.infer<typeof channelSnapshot>;
export interface YouTubeState {
  configured: boolean;
  connected: boolean;
  pending: boolean;
  error: string | null;
  snapshot: ChannelSnapshot | null;
}
