import { z } from "zod";
export const channelSnapshot = z
  .object({
    id: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
    title: z.string().min(1).max(200),
    views: z.number().int().nonnegative().nullable(),
    subscribers: z.number().int().nonnegative().nullable(),
    videos: z.number().int().nonnegative().nullable(),
    syncedAt: z.iso.datetime(),
    createdAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type ChannelSnapshot = z.infer<typeof channelSnapshot>;
export interface YouTubeState {
  configured: boolean;
  clientSource: "app" | "custom" | "none";
  appClientAvailable: boolean;
  connected: boolean;
  pending: boolean;
  error: string | null;
  snapshot: ChannelSnapshot | null;
  sync?: { message: string } | null;
}

import { dateOnly, parsedReport } from "./analytics";
export const dailySyncInput = z
  .object({ startDate: dateOnly, endDate: dateOnly })
  .strict()
  .refine((v) => {
    const days = (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000;
    return (
      days >= 0 &&
      days < 366 &&
      v.endDate <= new Date().toISOString().slice(0, 10)
    );
  }, "Choose a valid report range of at most 366 days, ending today or earlier.");
export type DailySyncInput = z.infer<typeof dailySyncInput>;
export interface SyncReportResult {
  reportId: string;
  duplicate: boolean;
}

export const historyPointer = z
  .object({
    channelId: channelSnapshot.shape.id,
    startDate: dateOnly,
    endDate: dateOnly,
    syncedAt: z.iso.datetime(),
    dailyId: z.uuid().nullable(),
    uploadsId: z.uuid().nullable(),
  })
  .strict();
export const channelHistory = historyPointer.extend({
  daily: parsedReport.nullable(),
  uploads: parsedReport.nullable(),
});
export type ChannelHistory = z.infer<typeof channelHistory>;
