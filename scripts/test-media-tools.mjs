// Synthetic-test helper only. This binary is not bundled with the application.
import { createHash } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  appendFileSync,
} from "node:fs";
import { resolve } from "node:path";
const hashes = {
  "darwin-arm64":
    "a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584",
  "darwin-x64":
    "ebdddc936f61e14049a2d4b549a412b8a40deeff6540e58a9f2a2da9e6b18894",
  "linux-x64":
    "e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99",
  "win32-x64":
    "04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00",
};
const target = `${process.platform}-${process.arch}`;
if (!hashes[target]) throw new Error("Unsupported test target");
mkdirSync(".cache/tools", { recursive: true });
const path = resolve(
  ".cache/tools",
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
);
if (!existsSync(path)) {
  const response = await globalThis.fetch(
    `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-${target}`,
  );
  if (!response.ok) throw new Error("Test media download failed");
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
}
if (
  createHash("sha256").update(readFileSync(path)).digest("hex") !==
  hashes[target]
)
  throw new Error("Test FFmpeg checksum mismatch");
chmodSync(path, 0o755);
if (process.env.GITHUB_ENV)
  appendFileSync(process.env.GITHUB_ENV, `CREATOR_DESK_TEST_FFMPEG=${path}\n`);
console.log("Verified synthetic-test FFmpeg");

// Archive fixture for the in-app setup test. Never included in packaged apps.
const { mediaDistribution } = await import("./media-distribution.mjs");
const distribution = mediaDistribution(process.platform, process.arch);
const archiveDir = resolve(".cache/media-setup", target);
mkdirSync(archiveDir, { recursive: true });
const archive = resolve(archiveDir, `download.${distribution.extension}`);
if (!existsSync(archive)) {
  const response = await globalThis.fetch(distribution.url);
  if (!response.ok) throw new Error("FFmpeg setup fixture download failed");
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
}
if (
  createHash("sha256").update(readFileSync(archive)).digest("hex") !==
  distribution.sha256
)
  throw new Error("FFmpeg setup fixture checksum mismatch");
console.log("Verified in-app FFmpeg setup archive fixture");
