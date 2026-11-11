import { z } from "zod";
import { dateOnly } from "./analytics";
export const REACH_CACHE_LIMIT = 4 * 1024 * 1024;
export const reachChannelId = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
const timestamp = z.iso.datetime({ offset: true });
export const reachRow = z.tuple([
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{11}$/)
    .nullable(),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  z.number().finite().min(0).max(100).nullable(),
]);
export type ReachRow = z.infer<typeof reachRow>;
export const reachManifest = z
  .object({
    workspaceId: z.uuid(),
    channelId: reachChannelId,
    jobId: z.string().min(1).max(40),
    reportId: z.string().min(1).max(100),
    day: dateOnly,
    startTime: timestamp,
    endTime: timestamp,
    createTime: timestamp,
    downloadedAt: timestamp,
    rowCount: z.number().int().min(0).max(20000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    parts: z.number().int().min(0).max(200),
  })
  .strict()
  .refine(
    (v) => Date.parse(v.startTime) < Date.parse(v.endTime),
    "Invalid reach period.",
  );
export const reachChunk = z.array(reachRow).min(1).max(100);
export type ReachManifest = z.infer<typeof reachManifest>;
export interface ReachBatch {
  metadata: ReachManifest;
  rows: ReachRow[];
}

export const reachSetup = z
  .object({
    workspaceId: z.uuid(),
    channelId: reachChannelId,
    jobId: z.string().min(1).max(40),
    jobCreatedAt: timestamp,
    checkedAt: timestamp.nullable(),
  })
  .strict();
export const reachQuery = z
  .object({
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    videoId: z
      .union([z.string().regex(/^[A-Za-z0-9_-]{11}$/), z.literal("unassigned")])
      .optional(),
    page: z.number().int().min(1).max(10000).default(1),
  })
  .strict()
  .refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    "Choose dates in chronological order.",
  );
export type ReachQuery = z.input<typeof reachQuery>;
export interface ReachOverview {
  channelId: string | null;
  enabled: boolean;
  busy: boolean;
  checkedAt: string | null;
  coveredDays: string[];
  selectedDays: number;
  firstDay: string | null;
  lastDay: string | null;
  impressions: number | null;
  ctr: number | null;
  series: { date: string; impressions: number | null; ctr: number | null }[];
  videos: { id: string; title: string }[];
  rows: {
    id: string;
    title: string;
    impressions: number | null;
    ctr: number | null;
  }[];
  page: number;
  pageCount: number;
}
