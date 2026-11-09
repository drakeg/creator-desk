export const mediaVersion: string;
export const mediaSourceURL: string;
export interface MediaDistribution {
  url: string;
  size: number;
  sha256: string;
  extension: string;
  executable: string;
}
export function mediaDistribution(
  platform: string,
  arch: string,
): MediaDistribution;
