/** Inclusive UTC calendar range, capped by available synced channel history.
 * Avoid local-time/DST arithmetic and do not invent dates before the cache.
 */
export function retentionPreset(
  startDate: string,
  endDate: string,
  days: 28 | 90 | "all",
): { startDate: string; endDate: string } | null {
  const valid = (value: string) => {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  };
  if (!valid(startDate) || !valid(endDate) || startDate > endDate) return null;
  if (days === "all") return { startDate, endDate };
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const recent = new Date(end - (days - 1) * 86400000)
    .toISOString().slice(0, 10);
  return { startDate: recent < startDate ? startDate : recent, endDate };
}
