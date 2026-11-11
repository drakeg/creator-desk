import { z } from "zod";
import { downloadableReachReport } from "./reach-download";
import { CoreError } from "../../shared/contracts";
import { GoogleError, googleJSON, type Transport } from "./http";
// Only ingest schemas explicitly supported by this build; newer revisions require parser review.
export const REACH_REPORT_TYPE = "channel_reach_basic_a1";
const timestamp = z.iso.datetime({ offset: true });
const reportType = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  deprecateTime: timestamp.optional(),
  systemManaged: z.boolean().optional(),
});
const job = z.object({
  id: z.string().min(1).max(40),
  reportTypeId: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  createTime: timestamp,
  expireTime: timestamp.optional(),
  systemManaged: z.boolean().optional(),
});
export type ReportingJob = z.infer<typeof job>;
function invalid(): never {
  throw new CoreError(
    "REMOTE_ERROR",
    "YouTube returned invalid reporting-job data. Try again; existing analytics are unchanged.",
  );
}
/** Main-process client. Account ownership comes from the caller's protected channel token. */
export class Reporting {
  constructor(
    private token: string,
    private transport: Transport,
    private guard: () => void = () => {},
  ) {}
  private async request(
    path: "reportTypes" | "jobs" | `jobs/${string}/reports`,
    init: RequestInit = {},
    query?: URLSearchParams,
  ) {
    this.guard();
    const url = new URL(`https://youtubereporting.googleapis.com/v1/${path}`);
    if (query) url.search = query.toString();
    try {
      const value = await googleJSON(
        url.href,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${this.token}`,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
          },
        },
        this.transport,
      );
      this.guard();
      return value;
    } catch (error) {
      this.guard();
      if (error instanceof GoogleError && error.status === 403)
        throw new CoreError(
          "REMOTE_ERROR",
          "YouTube Reporting API access was denied. Enable YouTube Reporting API in your Google project and check Analytics permission and quota. Existing analytics are unchanged.",
        );
      throw error;
    }
  }
  private async pages<T>(
    path: "reportTypes" | "jobs" | `jobs/${string}/reports`,
    field: "reportTypes" | "jobs" | "reports",
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const values: T[] = [],
      seen = new Set<string>();
    let token: string | undefined;
    for (let page = 0; page < 100; page++) {
      const root = z
        .object({ nextPageToken: z.string().min(1).max(2048).optional() })
        .passthrough()
        .safeParse(
          await this.request(
            path,
            {},
            new URLSearchParams({
              pageSize: "100",
              ...(field !== "reports" ? { includeSystemManaged: "false" } : {}),
              ...(token ? { pageToken: token } : {}),
            }),
          ),
        );
      if (!root.success) invalid();
      const items = z
        .array(schema)
        .max(1000)
        .default([])
        .safeParse(root.data[field]);
      if (!items.success) invalid();
      values.push(...items.data);
      if (values.length > 10000)
        throw new CoreError(
          "REMOTE_ERROR",
          "YouTube returned too many reporting records. Existing analytics are unchanged.",
        );
      token = root.data.nextPageToken;
      if (!token) return values;
      if (seen.has(token)) invalid();
      seen.add(token);
    }
    throw new CoreError(
      "REMOTE_ERROR",
      "YouTube returned too many reporting-job pages. Existing analytics are unchanged.",
    );
  }
  async listReachReports(jobId: string) {
    const id = z.string().min(1).max(40).parse(jobId);
    const reports = await this.pages(
      `jobs/${encodeURIComponent(id)}/reports`,
      "reports",
      downloadableReachReport,
    );
    if (reports.some((report) => report.jobId !== id)) invalid();
    const ids = new Set<string>();
    for (const report of reports) {
      if (ids.has(report.id)) invalid();
      ids.add(report.id);
    }
    return reports;
  }
  async ensureReachJob(): Promise<{
    job: ReportingJob;
    created: boolean;
    state: "job-ready";
  }> {
    const types = await this.pages("reportTypes", "reportTypes", reportType);
    if (
      !types.some(
        (type) =>
          type.id === REACH_REPORT_TYPE &&
          !type.systemManaged &&
          !type.deprecateTime,
      )
    )
      throw new CoreError(
        "REMOTE_ERROR",
        "A supported basic reach report is not available for this channel. Impressions and CTR remain unavailable; existing analytics are unchanged.",
      );
    const jobs = await this.pages("jobs", "jobs", job);
    const existing = jobs
      .filter(
        (value) =>
          value.reportTypeId === REACH_REPORT_TYPE &&
          !value.systemManaged &&
          (!value.expireTime || Date.parse(value.expireTime) > Date.now()),
      )
      .sort(
        (a, b) =>
          a.createTime.localeCompare(b.createTime) || a.id.localeCompare(b.id),
      )[0];
    if (existing) return { job: existing, created: false, state: "job-ready" };
    const created = job.safeParse(
      await this.request("jobs", {
        method: "POST",
        body: JSON.stringify({
          reportTypeId: REACH_REPORT_TYPE,
          name: "Creator Desk reach analytics",
        }),
      }),
    );
    if (
      !created.success ||
      created.data.reportTypeId !== REACH_REPORT_TYPE ||
      created.data.systemManaged ||
      (created.data.expireTime &&
        Date.parse(created.data.expireTime) <= Date.now())
    )
      invalid();
    return { job: created.data, created: true, state: "job-ready" };
  }
}
