export interface ReleaseTarget {
  platform: string;
  arch: string;
  label: string;
  prefix: string;
  directory: string;
  application: string;
  executable: string;
  assets: string[];
}
export const targets: { platform: string; arch: string; label: string }[];
export function releaseTarget(
  platform: string,
  arch: string,
  version: string,
): ReleaseTarget;
