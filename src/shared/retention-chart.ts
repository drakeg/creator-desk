/** Chart axis label policy: do not overlap the peak and 100% reference.
 * Even peaks just above 100% may have nearly identical pixel positions.
 * Always preserve raw watch ratios; this only changes labels.
 */
export function retentionTopLabel(maxWatchRatio: number): string | null {
  if (!Number.isFinite(maxWatchRatio) || maxWatchRatio <= 1.15) return null;
  return `${Math.round(maxWatchRatio * 100)}%`;
}
