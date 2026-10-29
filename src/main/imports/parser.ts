import { CoreError } from "../../shared/contracts";
import {
  dateOnly,
  parsedReport,
  type MetricRow,
  type ParsedReport,
} from "../../shared/analytics";
const aliases: Record<string, string> = {
  content: "id",
  "video id": "id",
  id: "id",
  "video title": "title",
  title: "title",
  date: "date",
  "video publish time": "published",
  "published date": "published",
  published: "published",
  views: "views",
  "watch time (hours)": "watchHours",
  watchhours: "watchHours",
  subscribers: "subscribers",
  impressions: "impressions",
};
function bad(message: string): never {
  throw new CoreError("INVALID_INPUT", message);
}
function csv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0];
  let delimiter = ",";
  let best = 0;
  for (const candidate of [",", "\t", ";"]) {
    let quoted = false;
    let count = 0;
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '"') {
        if (quoted && first[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && first[i] === candidate) count++;
    }
    if (count > best) {
      best = count;
      delimiter = candidate;
    }
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  function finishField() {
    row.push(field);
    field = "";
    afterQuote = false;
  }
  function finishRow() {
    finishField();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
    if (rows.length > 20002)
      bad("This file exceeds the 20,000-record import limit.");
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += c;
    } else if (c === delimiter) finishField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (c === '"') {
      if (field !== "" || afterQuote)
        bad(`Record ${rows.length + 1}: unexpected quote.`);
      quoted = true;
    } else if (afterQuote) {
      if (c !== " " && c !== "\t")
        bad(`Record ${rows.length + 1}: text after a quoted field.`);
    } else field += c;
  }
  if (quoted)
    bad("An unfinished quoted field was found. Export the CSV again.");
  if (field !== "" || row.length || afterQuote) finishRow();
  return rows;
}
function normalizeDate(raw: string, label: string): string | null {
  if (!raw.trim()) return null;
  let result = raw.trim();
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const named = /^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/.exec(result);
  if (named) {
    const month = months.indexOf(named[1].toLowerCase());
    if (month < 0) bad(`${label}: unsupported date.`);
    result = `${named[3]}-${String(month + 1).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
  } else if (
    /^\d{4}-\d{2}-\d{2}T/.test(result) &&
    Number.isFinite(Date.parse(result))
  )
    result = result.slice(0, 10);
  const parsed = dateOnly.safeParse(result);
  if (!parsed.success)
    bad(
      `${label}: use an ISO date (YYYY-MM-DD) or an English date such as Oct 10, 2026.`,
    );
  return result;
}
function numeric(
  raw: unknown,
  label: string,
  integer: boolean,
  negative = false,
): number | null {
  if (
    raw === null ||
    raw === undefined ||
    String(raw).trim() === "" ||
    String(raw).trim() === "—" ||
    String(raw).trim() === "-"
  )
    return null;
  const value = String(raw).trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value))
    bad(`${label}: invalid number. Use English decimal notation.`);
  const n = Number(value.replaceAll(",", ""));
  if (
    !Number.isFinite(n) ||
    Math.abs(n) > Number.MAX_SAFE_INTEGER ||
    (!negative && n < 0) ||
    (integer && !Number.isSafeInteger(n))
  )
    bad(`${label}: invalid ${integer ? "whole number" : "number"}.`);
  return n;
}
export function parseImport(text: string, fileName: string): ParsedReport {
  if (Buffer.byteLength(text, "utf8") > 8 * 1024 * 1024)
    bad("This file exceeds the 8 MB import limit.");
  text = text.replace(/^\ufeff/, "");
  let objects: Record<string, unknown>[];
  let headers: string[];
  if (fileName.toLowerCase().endsWith(".json")) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      bad("The JSON file is not valid. Choose an array of report records.");
    }
    if (!Array.isArray(data) || !data.length || data.length > 20001)
      bad("JSON imports must contain 1–20,000 records.");
    objects = data.map((v, i) => {
      if (typeof v !== "object" || v === null || Array.isArray(v))
        bad(`Record ${i + 1}: expected an object.`);
      return v as Record<string, unknown>;
    });
    headers = [...new Set(objects.flatMap((v) => Object.keys(v)))];
  } else {
    const records = csv(text);
    if (records.length < 2)
      bad("The file needs a header and at least one data record.");
    headers = records[0].map((h) => h.trim());
    objects = records.slice(1).map((values, i) => {
      if (values.length !== headers.length)
        bad(
          `Record ${i + 2}: expected ${headers.length} fields, found ${values.length}.`,
        );
      return Object.fromEntries(headers.map((h, j) => [h, values[j]]));
    });
  }
  if (headers.length > 100)
    bad(
      "This file has too many columns. Export a video or daily table with up to 100 columns.",
    );
  const mapping = new Map<string, string>();
  const used = new Set<string>();
  const unknown: string[] = [];
  for (const h of headers) {
    const key = aliases[h.trim().toLowerCase()];
    if (!key) {
      unknown.push(h);
      continue;
    }
    if (used.has(key)) bad(`The file has more than one ${key} column.`);
    used.add(key);
    mapping.set(h, key);
  }
  if (!used.has("views"))
    bad(
      "A Views column is required. Use an English YouTube Studio video or daily report.",
    );
  const kind = used.has("date")
    ? "daily"
    : used.has("id") && used.has("title")
      ? "videos"
      : bad(
          "Use a video report with Content and Video title columns, or a daily report with a Date column.",
        );
  if (kind === "daily" && used.has("id"))
    bad(
      "This file mixes dates and videos. Export a daily channel report or a video table separately.",
    );
  const warnings: string[] = [];
  if (unknown.length)
    warnings.push(
      `Ignored ${unknown.length} unsupported column(s): ${unknown
        .slice(0, 5)
        .map((s) => s.slice(0, 40))
        .join(", ")}.`,
    );
  const rows: MetricRow[] = [];
  const ids = new Set<string>();
  let totalViews: number | null = null;
  let skipped = 0;
  objects.forEach((object, index) => {
    const record: Record<string, unknown> = {};
    for (const [header, key] of mapping) record[key] = object[header];
    const scalar = (key: string) => {
      const v = record[key];
      if (
        v !== null &&
        v !== undefined &&
        typeof v !== "string" &&
        typeof v !== "number"
      )
        bad(`Record ${index + 2}: ${key} must be text or a number.`);
      return v === null || v === undefined ? "" : String(v);
    };
    const identity = scalar(kind === "daily" ? "date" : "id").trim();
    if (/^(total|totals)$/i.test(identity)) {
      skipped++;
      const n = numeric(record.views, "Total views", true);
      if (n !== null) totalViews = n;
      return;
    }
    const date =
      kind === "daily"
        ? normalizeDate(identity, `Record ${index + 2} date`)
        : null;
    const id = kind === "daily" ? date : identity;
    if (!id || id.length > 200)
      bad(
        `Record ${index + 2}: a valid ${kind === "daily" ? "date" : "video ID"} is required.`,
      );
    if (ids.has(id))
      bad(
        `Record ${index + 2}: duplicate ${kind === "daily" ? "date" : "video ID"} ${id.slice(0, 60)}. Export a single table.`,
      );
    ids.add(id);
    const title = kind === "videos" ? scalar("title").trim() : date!;
    if (kind === "videos" && (!title || title.length > 1000))
      bad(`Record ${index + 2}: a title of 1–1,000 characters is required.`);
    const views = numeric(record.views, `Record ${index + 2} views`, true);
    if (views === null) bad(`Record ${index + 2}: Views cannot be blank.`);
    rows.push({
      id,
      title,
      date,
      published:
        kind === "videos"
          ? normalizeDate(
              scalar("published"),
              `Record ${index + 2} publication date`,
            )
          : null,
      views,
      watchHours: numeric(
        record.watchHours,
        `Record ${index + 2} watch time`,
        false,
      ),
      subscribers: numeric(
        record.subscribers,
        `Record ${index + 2} subscribers`,
        true,
        true,
      ),
      impressions: numeric(
        record.impressions,
        `Record ${index + 2} impressions`,
        true,
      ),
    });
  });
  if (!rows.length)
    bad(
      "No video or daily records were found. A Total row alone cannot be imported.",
    );
  if (rows.length > 20000)
    bad("This file exceeds the 20,000-record import limit.");
  if (skipped)
    warnings.push(
      `Skipped ${skipped} Total row(s) to avoid counting the same data twice.`,
    );
  const sum = rows.reduce((n, r) => n + r.views, 0);
  if (!Number.isSafeInteger(sum))
    bad("The total views exceed the supported numeric range.");
  if (totalViews !== null && totalViews !== sum)
    warnings.push(
      "The reported Total differs from the row sum. This export may be a subset; dashboard totals use imported rows only.",
    );
  if (rows.length >= 500)
    warnings.push(
      "Studio exports can be limited to 500 rows. Check that your export contains all the records you need.",
    );
  const metrics = (
    ["views", "watchHours", "subscribers", "impressions"] as const
  ).filter((key) => used.has(key));
  const missing = metrics.filter((key) => rows.some((r) => r[key] === null));
  if (missing.length)
    warnings.push(
      "Some metric cells are blank. Summary totals for incomplete metrics will be unavailable.",
    );
  return parsedReport.parse({ kind, rows, warnings, metrics });
}
