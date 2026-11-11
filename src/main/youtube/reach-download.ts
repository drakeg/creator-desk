import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import { type Transport } from "./http";
import { REACH_DOWNLOAD_LIMIT } from "./reach-parser";
export const downloadableReachReport = z
  .object({
    id: z.string().min(1).max(100),
    jobId: z.string().min(1).max(40),
    startTime: z.iso.datetime({ offset: true }),
    endTime: z.iso.datetime({ offset: true }),
    createTime: z.iso.datetime({ offset: true }),
    downloadUrl: z.string().max(4096).url(),
  })
  .refine((v) => {
    const hours = (Date.parse(v.endTime) - Date.parse(v.startTime)) / 3600000;
    return hours >= 23 && hours <= 25;
  }, "Expected one reporting day.");
export type DownloadableReachReport = z.infer<typeof downloadableReachReport>;
export function reportingDownloadURL(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CoreError(
      "REMOTE_ERROR",
      "Invalid reporting download destination.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "youtubereporting.googleapis.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/v1/media/") ||
    url.pathname === "/v1/media/"
  )
    throw new CoreError(
      "REMOTE_ERROR",
      "YouTube returned an unsupported reporting download destination. Google authorization was not sent.",
    );
  return url.href;
}
export async function downloadReachCSV(
  raw: string,
  token: string,
  transport: Transport,
  guard: () => void = () => {},
) {
  const url = reportingDownloadURL(raw);
  guard();
  try {
    const response = await transport(url, {
      headers: { Authorization: `Bearer ${token}`, "Accept-Encoding": "gzip" },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    guard();
    if (!response.ok || response.status >= 300 || !response.body)
      throw new Error("Download failed");
    const length = response.headers.get("content-length");
    if (
      length &&
      (!/^\d+$/.test(length) || Number(length) > REACH_DOWNLOAD_LIMIT)
    )
      throw new Error("Oversized report");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        guard();
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > REACH_DOWNLOAD_LIMIT) throw new Error("Oversized report");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    let bytes = Buffer.concat(chunks);
    // fetch commonly decompresses HTTP gzip itself; only decode a remaining gzip envelope.
    if (bytes[0] === 0x1f && bytes[1] === 0x8b)
      bytes = gunzipSync(bytes, { maxOutputLength: REACH_DOWNLOAD_LIMIT });
    guard();
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    guard();
    if (error instanceof CoreError) throw error;
    throw new CoreError(
      "REMOTE_ERROR",
      "The reach report could not be downloaded or exceeded its 8 MiB limit. Saved reach history is unchanged. Try again.",
    );
  }
}
export function reportingDay(startTime: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startTime));
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
