import { resolve, join } from "node:path";
export const targets = [
  { platform: "darwin", arch: "arm64", label: "mac-arm64" },
  { platform: "darwin", arch: "x64", label: "mac-x64" },
  { platform: "win32", arch: "x64", label: "windows-x64" },
  { platform: "linux", arch: "x64", label: "linux-x64" },
];
export function releaseTarget(platform, arch, version) {
  const target = targets.find(
    (t) => t.platform === platform && t.arch === arch,
  );
  if (!target || !/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("Unsupported release target or version.");
  const prefix = `Creator-Desk-${version}-${target.label}`;
  const directory = resolve(`out/Creator Desk-${platform}-${arch}`);
  const application =
    platform === "darwin" ? join(directory, "Creator Desk.app") : directory;
  const executable =
    platform === "darwin"
      ? join(application, "Contents/MacOS/Creator Desk")
      : join(
          application,
          platform === "win32" ? "creator-desk.exe" : "creator-desk",
        );
  return {
    ...target,
    prefix,
    directory,
    application,
    executable,
    assets:
      platform === "darwin"
        ? [`${prefix}.dmg`, `${prefix}.zip`]
        : platform === "win32"
          ? [`${prefix}-Setup.exe`, `${prefix}.zip`]
          : [`${prefix}.deb`],
  };
}
