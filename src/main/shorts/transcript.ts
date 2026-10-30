import { CoreError } from "../../shared/contracts";
import { cue, type Cue, type Clip } from "../../shared/shorts";
export function validateCues(input: unknown, duration: number): Cue[] {
  if (!Array.isArray(input) || !input.length || input.length > 10000)
    throw new CoreError(
      "INVALID_INPUT",
      "Use a timed transcript with 1–10,000 cues.",
    );
  const cues = input
    .map((value) => cue.parse(value))
    .sort((a, b) => a.start - b.start);
  if (
    cues.some((c) => c.end > duration + 0.25) ||
    cues.reduce((n, c) => n + c.text.length, 0) > 240000
  )
    throw new CoreError(
      "INVALID_INPUT",
      "Transcript exceeds the video duration or the 240,000-character limit.",
    );
  const bounded = cues
    .filter((c) => c.start < duration)
    .map((c) => ({ ...c, end: Math.min(c.end, duration) }));
  if (!bounded.length)
    throw new CoreError(
      "INVALID_INPUT",
      "Transcript has no cues inside the video.",
    );
  return bounded;
}
function seconds(raw: string) {
  const parts = raw.replace(",", ".").split(":").map(Number);
  if (parts.at(-1)! >= 60 || parts.at(-2)! >= 60)
    throw new CoreError("INVALID_INPUT", "Invalid subtitle timestamp.");
  return parts.reduce((n, p) => n * 60 + p, 0);
}
export function parseTranscript(text: string, duration: number): Cue[] {
  const result: Cue[] = [];
  for (const block of text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((l) => l.includes("-->"));
    if (index < 0) continue;
    const match = lines[index]!.match(
      /^\s*((?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{3})(?:\s.*)?$/,
    );
    if (!match)
      throw new CoreError(
        "INVALID_INPUT",
        "Invalid subtitle timing. Choose an SRT or WebVTT transcript.",
      );
    const value = lines
      .slice(index + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (value)
      result.push({
        start: seconds(match[1]!),
        end: seconds(match[2]!),
        text: value,
      });
  }
  return validateCues(result, duration);
}
export function srt(cues: Cue[], clip: Pick<Clip, "start" | "end">): string {
  const stamp = (n: number) => {
    const ms = Math.round(n * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return cues
    .filter((c) => c.end > clip.start && c.start < clip.end)
    .map(
      (c, i) =>
        `${i + 1}\n${stamp(Math.max(0, c.start - clip.start))} --> ${stamp(Math.min(clip.end, c.end) - clip.start)}\n${c.text.replace(/[<>{}\\]/g, "")}\n`,
    )
    .join("\n");
}
