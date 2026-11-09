// Pinned upstream downloads. No media binary is redistributed inside Creator Desk.
export const mediaVersion = "8.1.3-2";
export const mediaSourceURL =
  "https://github.com/jellyfin/jellyfin-ffmpeg/tree/v8.1.3-2";
const assets = {
  "darwin-arm64": [
    "macarm64",
    "tar.xz",
    32904768,
    "d898cc819e7c4e9219d6410ddbdaada0838f14bec6ff89e283639915394cb43f",
  ],
  "darwin-x64": [
    "mac64",
    "tar.xz",
    38099916,
    "d394180f1155f84857544a48a99869f5741ccc50c5a1f73d2797429a2b326448",
  ],
  "linux-x64": [
    "linux64",
    "tar.xz",
    60657368,
    "1df84d04c4322902dba81c290508cdf3d89524d210b9fe03154bea6c4e3bfbb6",
  ],
  "win32-x64": [
    "win64-clang",
    "zip",
    68466554,
    "b65dd5011a80b5abec08bd559489cf188217238c8e38b5bf553504c974f5694d",
  ],
};
export function mediaDistribution(platform, arch) {
  const value = assets[`${platform}-${arch}`];
  if (!value)
    throw new Error(
      "Automatic FFmpeg setup is unavailable on this platform. Choose an installed executable instead.",
    );
  const [target, extension, size, sha256] = value;
  return {
    url: `https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v${mediaVersion}/jellyfin-ffmpeg_${mediaVersion}_portable_${target}-gpl.${extension}`,
    size,
    sha256,
    extension,
    executable: platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  };
}
