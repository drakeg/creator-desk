import {
  channelHistory,
  historyPointer,
  type ChannelHistory,
} from "../../shared/youtube";
import { parsedReport, type ParsedReport } from "../../shared/analytics";
import { CoreError } from "../../shared/contracts";
import { Store } from "../storage/store";
import { Reports } from "../imports/reports";
import { dailyReport } from "./report-data";
import type { Transport } from "./http";
const key = (id: string) => `youtube-history-${id}`;
export const dayAfter = (date: string) =>
  new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
export async function historicalDaily(
  token: string,
  channelId: string,
  startDate: string,
  endDate: string,
  transport: Transport,
  progress: (message: string) => void,
) {
  const rows: ParsedReport["rows"] = [];
  for (let start = startDate; start <= endDate;) {
    const end = new Date(
      Math.min(Date.parse(start) + 365 * 86400000, Date.parse(endDate)),
    )
      .toISOString()
      .slice(0, 10);
    progress(`Reading daily history: ${start} to ${end}`);
    const report = await dailyReport(
      token,
      channelId,
      { startDate: start, endDate: end },
      transport,
      true,
    );
    if (report) rows.push(...report.rows);
    start = dayAfter(end);
  }
  if (!rows.length) return null;
  return parsedReport.parse({
    kind: "daily",
    rows,
    metrics: ["views", "watchHours", "subscribers"],
    warnings: [
      `Requested ${startDate} to ${endDate}. Only dates returned by YouTube are included; absent dates remain unavailable. Recent metrics can be delayed.`,
    ],
  });
}
export class History {
  constructor(private store: Store) {}
  load(workspaceId: string): ChannelHistory | null {
    const value = this.store.setting(key(workspaceId), null);
    if (!value) return null;
    const pointer = historyPointer.parse(value);
    const read = (id: string | null, kind: "daily" | "videos") => {
      if (!id) return null;
      const row = this.store.db
        .prepare(
          "SELECT metadata,payload FROM reports WHERE id=? AND workspace_id=?",
        )
        .get(id, workspaceId);
      if (!row)
        throw new CoreError(
          "NOT_FOUND",
          "Saved channel history was removed. Sync channel history again.",
        );
      const metadata = JSON.parse(String(row.metadata));
      const report = parsedReport.parse(JSON.parse(String(row.payload)));
      if (
        metadata.deletedAt ||
        metadata.channelId !== pointer.channelId ||
        metadata.source !==
          (kind === "daily"
            ? "youtube-history-daily"
            : "youtube-history-uploads") ||
        report.kind !== kind
      )
        throw new CoreError(
          "NOT_FOUND",
          "Saved channel history was removed. Sync channel history again.",
        );
      return report;
    };
    return channelHistory.parse({
      ...pointer,
      daily: read(pointer.dailyId, "daily"),
      uploads: read(pointer.uploadsId, "videos"),
    });
  }
  save(
    workspaceId: string,
    channelId: string,
    channelName: string,
    startDate: string,
    endDate: string,
    daily: ParsedReport | null,
    uploads: ParsedReport | null,
  ) {
    return this.store.transaction(() => {
      const previous = historyPointer
        .nullable()
        .parse(this.store.setting(key(workspaceId), null));
      // Only replace this cache's owned records; imports and manually saved reports are untouched.
      for (const id of [previous?.dailyId, previous?.uploadsId])
        if (id)
          this.store.db
            .prepare(
              "DELETE FROM reports WHERE id=? AND workspace_id=? AND json_extract(metadata, '$.source') IN ('youtube-history-daily', 'youtube-history-uploads')",
            )
            .run(id, workspaceId);
      const reports = new Reports(this.store);
      const save = (
        data: ParsedReport | null,
        source: "youtube-history-daily" | "youtube-history-uploads",
      ) =>
        data
          ? reports.saveYouTube(data, {
              channelName: channelName.slice(0, 100),
              channelId,
              source,
              fileName:
                source === "youtube-history-daily"
                  ? "Channel daily history"
                  : "Channel video library",
              periodStart: data.kind === "daily" ? data.rows[0]!.date : null,
              periodEnd: data.kind === "daily" ? data.rows.at(-1)!.date : null,
            }).reportId
          : null;
      const pointer = historyPointer.parse({
        channelId,
        startDate,
        endDate,
        syncedAt: new Date().toISOString(),
        dailyId: save(daily, "youtube-history-daily"),
        uploadsId: save(uploads, "youtube-history-uploads"),
      });
      this.store.db
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key(workspaceId), JSON.stringify(pointer));
      return this.load(workspaceId)!;
    });
  }
}
