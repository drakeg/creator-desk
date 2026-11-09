import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  renameSync,
  chmodSync,
  statSync,
} from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CoreError } from "../../shared/contracts";
import {
  mediaDistribution,
  mediaVersion,
  type MediaDistribution,
} from "../../../scripts/media-distribution.mjs";
import { runFFmpeg } from "./ffmpeg";
const execute = promisify(execFile);
export function managedMediaPath(root: string) {
  return join(
    root,
    "media-tools",
    mediaVersion,
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
}
export async function verifyMediaArchive(
  path: string,
  asset: Pick<MediaDistribution, "size" | "sha256">,
) {
  if (statSync(path).size !== asset.size)
    throw new CoreError(
      "INVALID_INPUT",
      "FFmpeg download has an unexpected size. Try setup again.",
    );
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest("hex") !== asset.sha256)
    throw new CoreError(
      "INVALID_INPUT",
      "FFmpeg download failed its checksum check. Nothing was installed.",
    );
}
export async function installMedia(
  root: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const asset = mediaDistribution(process.platform, process.arch);
  const parent = join(root, "media-tools");
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temp = mkdtempSync(join(parent, ".setup-"));
  const timeout = AbortSignal.timeout(300000);
  const bounded = AbortSignal.any([signal, timeout]);
  try {
    bounded.throwIfAborted();
    const archive = join(temp, `download.${asset.extension}`);
    const response = await fetch(asset.url, { signal: bounded });
    if (!response.ok || !response.body)
      throw new CoreError(
        "INVALID_INPUT",
        "FFmpeg download was unavailable. Try again later.",
      );
    const file = await open(archive, "wx", 0o600);
    let downloaded = 0;
    try {
      for await (const value of response.body) {
        bounded.throwIfAborted();
        downloaded += value.byteLength;
        if (downloaded > asset.size)
          throw new CoreError(
            "INVALID_INPUT",
            "FFmpeg download exceeded its expected size. Nothing was installed.",
          );
        await file.writeFile(value);
        progress((downloaded / asset.size) * 0.8);
      }
    } finally {
      await file.close();
    }
    await verifyMediaArchive(archive, asset);
    bounded.throwIfAborted();
    const unpacked = join(temp, "unpacked");
    mkdirSync(unpacked);
    // Extract only the known executable from the checksum-verified upstream archive.
    await execute("tar", ["-xf", archive, "-C", unpacked, asset.executable], {
      signal: bounded,
      timeout: 60000,
      maxBuffer: 256000,
      windowsHide: true,
    });
    const executable = join(unpacked, asset.executable);
    if (!existsSync(executable) || !statSync(executable).isFile())
      throw new Error("Missing media executable");
    chmodSync(executable, 0o755);
    progress(0.9);
    const version = await runFFmpeg(
      executable,
      ["-version"],
      bounded,
      undefined,
      10000,
    );
    if (
      !version.startsWith("ffmpeg version 8.1.3") ||
      !version.includes("--enable-libx264") ||
      !version.includes("--enable-libass")
    )
      throw new Error("Unexpected media build");
    bounded.throwIfAborted();
    const destination = managedMediaPath(root);
    mkdirSync(join(parent, mediaVersion), { recursive: true, mode: 0o700 });
    // A prior usable installation is retained. A cancelled/failed setup never replaces it.
    if (!existsSync(destination))
      renameSync(
        unpacked,
        join(parent, mediaVersion, `${process.platform}-${process.arch}`),
      );
    progress(1);
    return destination;
  } catch (error) {
    if (error instanceof CoreError) throw error;
    if (signal.aborted)
      throw new CoreError("CANCELLED", "FFmpeg setup cancelled.");
    throw new CoreError(
      "INVALID_INPUT",
      "FFmpeg setup could not finish. Check your internet connection, disk space, and system tar utility, then try again. You can also choose an installed executable.",
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
