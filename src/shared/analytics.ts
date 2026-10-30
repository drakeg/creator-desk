import { z } from "zod";
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Use a valid date in YYYY-MM-DD format.");
const count = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const metricRow = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().max(1000),
    date: dateOnly.nullable(),
    published: dateOnly.nullable(),
    views: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    watchHours: z
      .number()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    subscribers: z
      .number()
      .int()
      .min(-Number.MAX_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    impressions: count,
  })
  .strict();
export type MetricRow = z.infer<typeof metricRow>;
export const parsedReport = z
  .object({
    kind: z.enum(["videos", "daily"]),
    rows: z.array(metricRow).min(1).max(20000),
    warnings: z.array(z.string().max(500)).max(50),
    metrics: z
      .array(z.enum(["views", "watchHours", "subscribers", "impressions"]))
      .min(1)
      .max(4),
  })
  .strict()
  .superRefine((report, ctx) => {
    const ids = new Set<string>();
    for (const row of report.rows) {
      if (ids.has(row.id))
        ctx.addIssue({
          code: "custom",
          message: "Duplicate report identifier.",
        });
      ids.add(row.id);
      if (
        report.kind === "daily"
          ? row.date === null ||
            row.id !== row.date ||
            row.title !== row.date ||
            row.published !== null
          : row.date !== null || !row.title.trim()
      )
        ctx.addIssue({
          code: "custom",
          message: "Report rows do not match the report type.",
        });
    }
    if (
      !report.metrics.includes("views") ||
      new Set(report.metrics).size !== report.metrics.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid report metrics." });
  });
export type ParsedReport = z.infer<typeof parsedReport>;
export interface ImportPreview {
  previewId: string;
  fileName: string;
  kind: ParsedReport["kind"];
  rowCount: number;
  warnings: string[];
  metrics: ParsedReport["metrics"];
  sample: MetricRow[];
  periodStart: string | null;
  periodEnd: string | null;
  workspaceName: string;
}
export const commitImportInput = z
  .object({
    previewId: z.uuid(),
    channelName: z.string().trim().min(1).max(100),
    periodStart: dateOnly.nullable(),
    periodEnd: dateOnly.nullable(),
    periodUnknown: z.boolean(),
  })
  .strict()
  .refine(
    (v) =>
      v.periodUnknown
        ? v.periodStart === null && v.periodEnd === null
        : v.periodStart !== null &&
          v.periodEnd !== null &&
          v.periodStart <= v.periodEnd,
    "Choose the report start and end dates, or mark the period as unknown.",
  );
export type CommitImportInput = z.infer<typeof commitImportInput>;
export const reportSummary = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    channelName: z.string().min(1).max(100),
    fileName: z.string().min(1).max(255),
    kind: z.enum(["videos", "daily"]),
    rowCount: z.number().int().min(1).max(20000),
    periodStart: dateOnly.nullable(),
    periodEnd: dateOnly.nullable(),
    importedAt: z.iso.datetime(),
    source: z.enum(["import", "youtube-daily", "youtube-uploads"]).optional(),
    channelId: z
      .string()
      .regex(/^UC[A-Za-z0-9_-]{22}$/)
      .optional(),
  })
  .strict()
  .refine(
    (v) =>
      (v.periodStart === null && v.periodEnd === null) ||
      (v.periodStart !== null &&
        v.periodEnd !== null &&
        v.periodStart <= v.periodEnd),
    "Invalid report period.",
  )
  .refine(
    (v) =>
      !v.source ||
      v.source === "import" ||
      (!!v.channelId &&
        (v.source === "youtube-daily"
          ? v.kind === "daily"
          : v.kind === "videos" && v.periodStart === null)),
    "Invalid YouTube report provenance.",
  );
export type ReportSummary = z.infer<typeof reportSummary>;
export const dashboardInput = z
  .object({
    reportId: z.uuid().optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    search: z.string().max(200).default(""),
    sort: z
      .enum([
        "views",
        "watchHours",
        "subscribers",
        "published",
        "title",
        "date",
      ])
      .default("views"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    page: z.number().int().min(1).max(1000).default(1),
  })
  .strict()
  .refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    "The start date must be on or before the end date.",
  );
export type DashboardInput = z.input<typeof dashboardInput>;
export interface Dashboard {
  reports: ReportSummary[];
  selected: ReportSummary | null;
  rows: MetricRow[];
  rowCount: number;
  page: number;
  pageCount: number;
  totals: {
    views: number | null;
    watchHours: number | null;
    subscribers: number | null;
    impressions: number | null;
  };
  series: { date: string; views: number }[];
  warnings: string[];
}
