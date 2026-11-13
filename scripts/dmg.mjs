import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const arch = process.env.CREATOR_DESK_ARCH || process.arch;
if (!["arm64", "x64"].includes(arch))
  throw new Error("Unsupported Mac architecture");
const output = resolve("out/make");
mkdirSync(output, { recursive: true });
const destination = join(output, `Creator-Desk-${version}-mac-${arch}.dmg`);
const staging = mkdtempSync(resolve(".cache/dmg-"));
try {
  cpSync(
    resolve(`out/Creator Desk-darwin-${arch}/Creator Desk.app`),
    join(staging, "Creator Desk.app"),
    { recursive: true, verbatimSymlinks: true },
  );
  symlinkSync("/Applications", join(staging, "Applications"));
  const major = Number(
    execFileSync("/usr/bin/sw_vers", ["-productVersion"], {
      encoding: "utf8",
    }).split(".")[0],
  );
  if (major >= 27) {
    // macOS 27 replaces the folder-image workflow with DiskManagement's image command.
    rmSync(destination, { force: true });
    execFileSync(
      "/usr/sbin/diskutil",
      [
        "image",
        "create",
        "from",
        "--verbose",
        "--format",
        "UDZO",
        "--volumeName",
        `Creator Desk ${version}`,
        staging,
        destination,
      ],
      { stdio: "inherit" },
    );
  } else {
    const args = [
      "create",
      "-volname",
      `Creator Desk ${version}`,
      "-srcfolder",
      staging,
      "-ov",
      "-fs",
      "HFS+",
      "-format",
      "UDZO",
      destination,
    ];
    // GitHub macOS runners occasionally report a transient disk-images
    // "Resource busy" error even after a successful app package/sign step.
    // Only retry this known transient; all other hdiutil failures fail fast.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = spawnSync("/usr/bin/hdiutil", args, {
        encoding: "utf8",
        timeout: 180000,
      });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.status === 0 && !result.error) break;
      const busy = /resource busy/i.test(result.stderr ?? "");
      if (!busy || attempt === 3 || result.error) {
        throw new Error(
          `hdiutil DMG creation failed on attempt ${attempt}: ${result.error?.message ?? result.stderr ?? `exit ${result.status}`}`,
        );
      }
      rmSync(destination, { force: true });
      console.warn(`hdiutil resource busy; retrying DMG creation (${attempt + 1}/3).`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 2000);
    }
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}
