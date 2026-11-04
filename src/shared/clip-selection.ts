import type { Clip } from "./shorts";
export function selectClipBoundary(
  current: Pick<Clip, "start" | "end">,
  boundary: "start" | "end",
  time: number,
  duration: number,
): Pick<Clip, "start" | "end"> {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    time < 0 ||
    time > duration
  )
    throw new Error("Choose a caption inside the video.");
  let start = boundary === "start" ? time : current.start;
  let end = boundary === "end" ? time : current.end;
  if (
    start < 0 ||
    end > duration ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end - start < 1 ||
    end - start > 180
  ) {
    if (boundary === "start") end = Math.min(duration, time + 60);
    else start = Math.max(0, time - 60);
  }
  if (end - start < 1)
    throw new Error("Choose a clip lasting at least one second.");
  return { start, end };
}
