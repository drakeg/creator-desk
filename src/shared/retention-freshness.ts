/** Relative cache freshness is only informational: a saved report can remain
 * useful offline regardless of age, and no stale result is erased.
 */
export function retentionFreshness(
  fetchedAt: string,
  now: Date = new Date(),
): { ageDays: number; stale: boolean } | null {
  const then = Date.parse(fetchedAt);
  const current = now.getTime();
  if (!Number.isFinite(then) || !Number.isFinite(current) || then > current) return null;
  const ageDays = Math.floor((current - then) / 86400000);
  return { ageDays, stale: ageDays >= 7 };
}
