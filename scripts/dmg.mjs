import { execFileSync } from "node:child_process";
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
    execFileSync(
      "/usr/bin/hdiutil",
      [
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
      ],
      { stdio: "inherit" },
    );
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}
