import { expect, it, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readdirSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { mediaDistribution } from "../../scripts/media-distribution.mjs";
import {
  verifyMediaArchive,
  installMedia,
  managedMediaPath,
} from "../../src/main/shorts/media-setup";
it("pins every supported native media archive and rejects unsupported platforms", () => {
  for (const [platform, arch] of [
    ["darwin", "arm64"],
    ["darwin", "x64"],
    ["win32", "x64"],
    ["linux", "x64"],
  ]) {
    const a = mediaDistribution(platform, arch);
    expect(a.url).toMatch(
      /^https:\/\/github.com\/jellyfin\/jellyfin-ffmpeg\/releases\/download\/v8\.1\.3-2\//,
    );
    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(a.size).toBeLessThan(70000000);
  }
  expect(() => mediaDistribution("linux", "arm64")).toThrow("unavailable");
});
it("rejects truncated or modified FFmpeg archives before extraction", async () => {
  const root = mkdtempSync(join(tmpdir(), "media-verify-"));
  try {
    const path = join(root, "download");
    writeFileSync(path, "fixture");
    const asset = {
      size: 7,
      sha256: createHash("sha256").update("fixture").digest("hex"),
    };
    await expect(verifyMediaArchive(path, asset)).resolves.toBeUndefined();
    await expect(
      verifyMediaArchive(path, { ...asset, size: 8 }),
    ).rejects.toThrow("size");
    writeFileSync(path, "changed");
    await expect(verifyMediaArchive(path, asset)).rejects.toThrow("checksum");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("cleans up a cancelled setup without installing an executable", async () => {
  const root = mkdtempSync(join(tmpdir(), "media-cancel-"));
  try {
    const controller = new AbortController();
    controller.abort();
    await expect(
      installMedia(root, controller.signal, () => {}),
    ).rejects.toThrow("cancelled");
    expect(readdirSync(join(root, "media-tools"))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("preserves a previous installation when a new download fails validation", async () => {
  const root = mkdtempSync(join(tmpdir(), "media-preserve-"));
  try {
    const previous = managedMediaPath(root);
    const { dirname } = await import("node:path");
    mkdirSync(dirname(previous), { recursive: true });
    writeFileSync(previous, "previous executable");
    vi.stubGlobal("fetch", async () => new Response("bad archive"));
    await expect(
      installMedia(root, new AbortController().signal, () => {}),
    ).rejects.toThrow("size");
    expect(readFileSync(previous, "utf8")).toBe("previous executable");
    expect(
      readdirSync(join(root, "media-tools")).some((name) =>
        name.startsWith(".setup-"),
      ),
    ).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    rmSync(root, { recursive: true, force: true });
  }
});
