/** Convert a known video duration and normalized position to readable elapsed time.
 * Null means no trustworthy duration is available; callers should keep progress
 * in percentages instead of guessing timestamps.
 */
export function retentionTime(
  durationSeconds: number | null | undefined,
  position: number,
): string | null {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 || !Number.isFinite(position) ||
      position < 0 || position > 1) return null;
  const seconds = Math.round(durationSeconds * position);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}
