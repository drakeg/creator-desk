import type { Transport } from "./http";
import { Reporting } from "./reporting";
import {
  downloadReachCSV,
  reportingDay,
  type DownloadableReachReport,
} from "./reach-download";
import { parseReachCSV } from "./reach-parser";
import { ReachCache, reachHash } from "./reach-cache";
import { REACH_CACHE_LIMIT, type ReachBatch } from "../../shared/reach";
import { CoreError } from "../../shared/contracts";
export async function ingestReachReports(
  token: string,
  jobId: string,
  workspaceId: string,
  channelId: string,
  transport: Transport,
  cache: ReachCache,
  guard: () => void = () => {},
) {
  const available = await new Reporting(
    token,
    transport,
    guard,
  ).listReachReports(jobId);
  const latest = new Map<string, DownloadableReachReport>();
  for (const report of available) {
    const day = reportingDay(report.startTime),
      previous = latest.get(day);
    if (
      previous &&
      (Date.parse(previous.startTime) !== Date.parse(report.startTime) ||
        Date.parse(previous.endTime) !== Date.parse(report.endTime))
    )
      throw new CoreError(
        "REMOTE_ERROR",
        "YouTube returned overlapping reach reporting periods. Saved reach history is unchanged.",
      );
    if (
      !previous ||
      Date.parse(report.createTime) > Date.parse(previous.createTime)
    )
      latest.set(day, report);
    else if (
      Date.parse(report.createTime) === Date.parse(previous.createTime) &&
      report.id !== previous.id
    )
      throw new CoreError(
        "REMOTE_ERROR",
        "YouTube returned conflicting reach revisions. Saved reach history is unchanged.",
      );
  }
  const saved = new Map(
    cache.metadata().map((metadata) => [metadata.day, metadata]),
  );
  const staged: ReachBatch[] = [];
  let stagedBytes = 0;
  for (const [day, report] of [...latest].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    guard();
    const previous = saved.get(day);
    if (
      previous &&
      Date.parse(previous.createTime) > Date.parse(report.createTime)
    )
      continue;
    if (
      previous &&
      previous.createTime === report.createTime &&
      previous.reportId === report.id &&
      previous.jobId === report.jobId
    )
      continue;
    const csv = await downloadReachCSV(
      report.downloadUrl,
      token,
      transport,
      guard,
    );
    const rows = parseReachCSV(csv, channelId, day);
    const batch: ReachBatch = {
      metadata: {
        workspaceId,
        channelId,
        jobId,
        reportId: report.id,
        startTime: report.startTime,
        endTime: report.endTime,
        createTime: report.createTime,
        day,
        downloadedAt: new Date().toISOString(),
        rowCount: rows.length,
        parts: Math.ceil(rows.length / 100),
        sha256: reachHash(rows),
      },
      rows,
    };
    stagedBytes += Buffer.byteLength(JSON.stringify(batch), "utf8");
    if (stagedBytes > REACH_CACHE_LIMIT)
      throw new CoreError(
        "STORAGE_UNAVAILABLE",
        "The reach refresh exceeds its 4 MiB staging limit. Saved reach history is unchanged.",
      );
    staged.push(batch);
  }
  guard();
  const updated = cache.publish(staged, guard);
  return {
    updated,
    availableDays: cache.metadata().length,
    state: available.length
      ? ("reports-processed" as const)
      : ("waiting-for-reports" as const),
  };
}
