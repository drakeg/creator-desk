import { constants, openSync, closeSync, fstatSync, readSync } from "node:fs";
import { basename, extname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { CoreError } from "../../shared/contracts";
import {
  commitImportInput,
  dashboardInput,
  parsedReport,
  reportSummary,
  type ImportPreview,
  type ReportSummary,
  type ParsedReport,
  type Dashboard,
} from "../../shared/analytics";
import { Store } from "../storage/store";
import { parseImport } from "./parser";
function fail(message: string): never {
  throw new CoreError("INVALID_INPUT", message);
}
interface Staged {
  preview: ImportPreview;
  data: ParsedReport;
  workspaceId: string;
  expires: number;
}
export class Reports {
  private staged: Staged | null = null;
  constructor(private store: Store) {}
  private workspace() {
    const state = this.store.state();
    const w = state.workspaces.find((w) => w.id === state.selectedWorkspaceId);
    if (!w) fail("Create or select a workspace before importing.");
    return w;
  }
  inspect(path: string): ImportPreview {
    this.cancel();
    const workspace = this.workspace();
    if (![".csv", ".json"].includes(extname(path).toLowerCase()))
      fail(
        "Choose a CSV or JSON file. Unzip Studio exports before importing a table.",
      );
    let text: string;
    try {
      const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.size > 8 * 1024 * 1024)
          fail("Choose a regular CSV/JSON file no larger than 8 MB.");
        const bytes = Buffer.alloc(stat.size + 1);
        let offset = 0;
        while (offset < bytes.length) {
          const n = readSync(fd, bytes, offset, bytes.length - offset, null);
          if (!n) break;
          offset += n;
        }
        if (offset !== stat.size)
          fail("The file changed while being read. Choose it again.");
        const buffer = bytes.subarray(0, offset);
        const encoding =
          buffer[0] === 255 && buffer[1] === 254
            ? "utf-16le"
            : buffer[0] === 254 && buffer[1] === 255
              ? "utf-16be"
              : "utf-8";
        text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      } finally {
        closeSync(fd);
      }
    } catch (error) {
      if (error instanceof CoreError) throw error;
      fail(
        "The file could not be read. Use a UTF-8 or UTF-16 CSV/JSON file, not a shortcut.",
      );
    }
    const data = parseImport(text!, basename(path));
    const dates = data.rows
      .map((r) => r.date)
      .filter((d): d is string => d !== null)
      .sort();
    const preview: ImportPreview = {
      previewId: randomUUID(),
      fileName: basename(path).slice(0, 255),
      kind: data.kind,
      rowCount: data.rows.length,
      warnings: data.warnings,
      metrics: data.metrics,
      sample: data.rows.slice(0, 3),
      periodStart: dates[0] ?? null,
      periodEnd: dates.at(-1) ?? null,
      workspaceName: workspace.name,
    };
    this.staged = {
      preview,
      data,
      workspaceId: workspace.id,
      expires: Date.now() + 15 * 60_000,
    };
    return preview;
  }
  cancel() {
    this.staged = null;
  }
  commit(input: unknown, now = Date.now()) {
    const values = commitImportInput.parse(input);
    const staged = this.staged;
    if (!staged || staged.preview.previewId !== values.previewId)
      fail("Choose and preview the import again.");
    if (now > staged!.expires) {
      this.cancel();
      fail("The import preview expired. Choose the file again.");
    }
    if (this.workspace().id !== staged!.workspaceId)
      fail("The workspace changed. Choose the file again in this workspace.");
    if (
      staged!.data.kind === "daily" &&
      (values.periodUnknown ||
        values.periodStart !== staged!.preview.periodStart ||
        values.periodEnd !== staged!.preview.periodEnd)
    )
      fail("Daily report dates must match the dates detected in the file.");
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          staged!.data.kind,
          staged!.data.rows.slice().sort((a, b) => a.id.localeCompare(b.id)),
          values.channelName,
          values.periodStart,
          values.periodEnd,
        ]),
      )
      .digest("hex");
    const existing = this.store.db
      .prepare("SELECT id FROM reports WHERE workspace_id=? AND fingerprint=?")
      .get(staged!.workspaceId, fingerprint);
    if (existing) {
      this.cancel();
      return { reportId: String(existing.id), duplicate: true };
    }
    const payload = JSON.stringify(staged!.data);
    const bytes = Number(
      this.store.db
        .prepare(
          "SELECT COALESCE(SUM(length(CAST(payload AS BLOB))),0) AS bytes FROM reports",
        )
        .get()?.bytes,
    );
    const count = Number(
      this.store.db.prepare("SELECT COUNT(*) AS count FROM reports").get()
        ?.count,
    );
    if (
      bytes + Buffer.byteLength(payload, "utf8") > 16 * 1024 * 1024 ||
      count >= 200
    )
      fail(
        "The preview’s local import limit has been reached (200 reports / 16 MB). Your existing reports are unchanged.",
      );
    const metadata: ReportSummary = {
      id: randomUUID(),
      workspaceId: staged!.workspaceId,
      channelName: values.channelName,
      fileName: staged!.preview.fileName,
      kind: staged!.data.kind,
      rowCount: staged!.data.rows.length,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      importedAt: new Date().toISOString(),
    };
    this.store.transaction(() =>
      this.store.db
        .prepare("INSERT INTO reports VALUES(?,?,?,?,?)")
        .run(
          metadata.id,
          metadata.workspaceId,
          JSON.stringify(metadata),
          payload,
          fingerprint,
        ),
    );
    this.cancel();
    return { reportId: metadata.id, duplicate: false };
  }
  dashboard(input: unknown): Dashboard {
    const query = dashboardInput.parse(input);
    const workspace = this.workspace();
    const reports = this.store.db
      .prepare(
        "SELECT metadata FROM reports WHERE workspace_id=? ORDER BY rowid DESC",
      )
      .all(workspace.id)
      .map((r) => reportSummary.parse(JSON.parse(String(r.metadata))));
    const selected = query.reportId
      ? reports.find((r) => r.id === query.reportId)
      : reports[0];
    if (query.reportId && !selected)
      throw new CoreError(
        "NOT_FOUND",
        "This report does not belong to the selected workspace.",
      );
    const empty: Dashboard = {
      reports,
      selected: null,
      rows: [],
      rowCount: 0,
      page: 1,
      pageCount: 1,
      totals: {
        views: null,
        watchHours: null,
        subscribers: null,
        impressions: null,
      },
      series: [],
      warnings: [],
    };
    if (!selected) return empty;
    if (selected.kind === "videos" && (query.startDate || query.endDate))
      fail(
        "Video exports contain period totals. Import a daily report to filter metrics by date.",
      );
    const raw = this.store.db
      .prepare("SELECT payload FROM reports WHERE id=? AND workspace_id=?")
      .get(selected.id, workspace.id)!;
    const data = parsedReport.parse(JSON.parse(String(raw.payload)));
    const search = query.search.trim().toLocaleLowerCase("en");
    const rows = data.rows.filter(
      (r) =>
        (!search ||
          r.title.toLocaleLowerCase("en").includes(search) ||
          r.id.toLowerCase().includes(search)) &&
        (!query.startDate || r.date! >= query.startDate) &&
        (!query.endDate || r.date! <= query.endDate),
    );
    const totals = { ...empty.totals };
    for (const key of [
      "views",
      "watchHours",
      "subscribers",
      "impressions",
    ] as const) {
      if (rows.length && rows.every((r) => r[key] !== null)) {
        const sum = rows.reduce((n, r) => n + r[key]!, 0);
        totals[key] =
          Number.isFinite(sum) && Math.abs(sum) <= Number.MAX_SAFE_INTEGER
            ? sum
            : null;
      }
    }
    const series =
      selected.kind === "daily"
        ? rows
            .map((r) => ({ date: r.date!, views: r.views }))
            .sort((a, b) => a.date.localeCompare(b.date))
        : [];
    const direction = query.direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[query.sort],
        bv = b[query.sort];
      if (av === null && bv !== null) return 1;
      if (bv === null && av !== null) return -1;
      let comparison =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), "en");
      if (comparison === 0) comparison = a.id.localeCompare(b.id);
      return comparison * direction;
    });
    const pageCount = Math.max(1, Math.ceil(rows.length / 25));
    const page = Math.min(query.page, pageCount);
    return {
      reports,
      selected,
      rows: rows.slice((page - 1) * 25, page * 25),
      rowCount: rows.length,
      page,
      pageCount,
      totals,
      series,
      warnings: data.warnings,
    };
  }
}
