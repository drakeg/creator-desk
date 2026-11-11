import { z } from "zod";

/** A single owned video's retention curve. Ratios are not percentages. */
export const retentionQuery = z.object({
  channelId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).strict().refine((value) => value.startDate <= value.endDate, {
  message: "Choose dates in chronological order.",
});
export type RetentionQuery = z.infer<typeof retentionQuery>;

export const retentionPoint = z.object({
  elapsedVideoTimeRatio: z.number().finite().min(0).max(1),
  audienceWatchRatio: z.number().finite().nonnegative(),
  relativeRetentionPerformance: z.number().finite().min(0).max(1),
}).strict();
export type RetentionPoint = z.infer<typeof retentionPoint>;

/**
 * Parse a bounded YouTube Analytics reports.query response, not an arbitrary
 * data table. An empty response means unavailable data, never zero retention.
 * Explicitly named columns avoid accidental metric/position transposition.
 */
export function parseRetentionResponse(raw: unknown): RetentionPoint[] {
  const response = z.object({
    columnHeaders: z.array(z.object({ name: z.string() }).passthrough()).length(3),
    rows: z.array(z.array(z.unknown()).length(3)).max(2000).optional(),
  }).passthrough().parse(raw);
  const expected = [
    "elapsedVideoTimeRatio",
    "audienceWatchRatio",
    "relativeRetentionPerformance",
  ];
  if (response.columnHeaders.some((header, index) => header.name !== expected[index])) {
    throw new Error("Unexpected retention report columns.");
  }
  let previous = -1;
  return (response.rows ?? []).map((row) => {
    const point = retentionPoint.parse({
      elapsedVideoTimeRatio: row[0],
      audienceWatchRatio: row[1],
      relativeRetentionPerformance: row[2],
    });
    if (point.elapsedVideoTimeRatio <= previous) {
      throw new Error("Retention positions must be strictly increasing.");
    }
    previous = point.elapsedVideoTimeRatio;
    return point;
  });
}
