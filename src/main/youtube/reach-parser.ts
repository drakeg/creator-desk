import { dateOnly } from "../../shared/analytics";
import { reachChannelId, reachRow, type ReachRow } from "../../shared/reach";
import { CoreError } from "../../shared/contracts";
import { parseCSV } from "../imports/parser";
export const REACH_DOWNLOAD_LIMIT = 8 * 1024 * 1024;
function invalid(): never {
  throw new CoreError(
    "REMOTE_ERROR",
    "YouTube returned an invalid basic reach report. Saved reach history is unchanged.",
  );
}
export function parseReachCSV(
  text: string,
  channelId: string,
  day: string,
): ReachRow[] {
  reachChannelId.parse(channelId);
  dateOnly.parse(day);
  if (Buffer.byteLength(text, "utf8") > REACH_DOWNLOAD_LIMIT) invalid();
  let table: string[][];
  try {
    table = parseCSV(text.replace(/^\uFEFF/, ""));
  } catch {
    invalid();
  }
  const header = table.shift()?.map((v) => v.trim());
  if (
    !header ||
    header.length > 128 ||
    new Set(header).size !== header.length ||
    header.some((v) => !v || v.length > 200)
  )
    invalid();
  const required = [
    "date",
    "channel_id",
    "video_id",
    "video_thumbnail_impressions",
    "video_thumbnail_impressions_ctr",
  ];
  const positions = required.map((name) => header.indexOf(name));
  if (
    positions.includes(-1) ||
    [
      "traffic_source_type",
      "traffic_source_detail",
      "operating_system",
      "device_type",
    ].some((name) => header.includes(name))
  )
    invalid();
  const seen = new Set<string>();
  return table.map((fields) => {
    if (fields.length !== header.length) invalid();
    const [rawDate, channel, video, rawCount, rawCtr] = positions.map((index) =>
      fields[index].trim(),
    );
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6)}`
      : rawDate;
    if (
      date !== day ||
      channel !== channelId ||
      !/^\d+$/.test(rawCount) ||
      (rawCtr !== "" && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawCtr)) ||
      seen.has(video)
    )
      invalid();
    seen.add(video);
    const parsed = reachRow.safeParse([
      video || null,
      Number(rawCount),
      rawCtr === "" ? null : Number(rawCtr),
    ]);
    if (!parsed.success) invalid();
    return parsed.data;
  });
}
