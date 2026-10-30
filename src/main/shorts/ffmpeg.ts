import { spawn } from "node:child_process";
import { CoreError } from "../../shared/contracts";
import type { Clip } from "../../shared/shorts";
export function demuxer(path: string) {
  return /\.(mp4|mov|m4v)$/i.test(path)
    ? "mov"
    : /\.webm$/i.test(path)
      ? "matroska"
      : (() => {
          throw new CoreError(
            "INVALID_INPUT",
            "Choose MP4, MOV, M4V, or WebM video.",
          );
        })();
}
export function filters(value: Clip) {
  const base =
    value.fit === "fit"
      ? "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black"
      : `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280:(iw-ow)*${value.focus}:(ih-oh)/2`;
  return `${base},setsar=1${value.captions ? ",subtitles=captions.srt:force_style='Fontsize=18,Alignment=2,MarginV=55,Outline=2'" : ""}`;
}
export async function runFFmpeg(
  executable: string,
  args: string[],
  signal: AbortSignal,
  cwd?: string,
  timeout = 1800000,
  allowFailure = false,
): Promise<string> {
  if (signal.aborted) throw new CoreError("CANCELLED", "Media job cancelled.");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let overflow = false;
    let expired = false;
    const collect = (data: Buffer) => {
      if (output.length + data.length > 256000) {
        overflow = true;
        terminate();
      } else output += data.toString();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    let force: ReturnType<typeof setTimeout> | undefined;
    const terminate = () => {
      if (force) return;
      child.kill();
      force = setTimeout(() => child.kill("SIGKILL"), 2000);
    };
    const abort = () => terminate();
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      expired = true;
      terminate();
    }, timeout);

    child.once("error", () => {
      clearTimeout(timer);
      clearTimeout(force);
      signal.removeEventListener("abort", abort);
      reject(
        new CoreError(
          "INVALID_INPUT",
          "FFmpeg could not start. Choose an installed FFmpeg executable.",
        ),
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(force);
      signal.removeEventListener("abort", abort);
      if (signal.aborted)
        reject(new CoreError("CANCELLED", "Media job cancelled."));
      else if (overflow || expired || (!allowFailure && code !== 0))
        reject(
          new CoreError(
            "INVALID_INPUT",
            "FFmpeg could not process this video. Check its format, available disk space, and FFmpeg codec/subtitle support.",
          ),
        );
      else resolve(output);
    });
  });
}
export function durationFromProbe(output: string) {
  const match = output.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = match
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : 0;
  if (!output.includes("Video:") || duration < 1 || duration > 21600)
    throw new CoreError(
      "INVALID_INPUT",
      "Choose a readable video with a known duration up to six hours.",
    );
  return duration;
}
