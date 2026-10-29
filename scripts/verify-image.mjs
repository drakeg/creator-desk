import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const imagePath = resolve(`out/make/Creator-Desk-${version}-mac-arm64.dmg`);
// Remove only attachments whose OS-reported backing image is this build artifact.
const xml = execFileSync("/usr/bin/hdiutil", ["info", "-plist"]);
const info = JSON.parse(
  execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], {
    input: xml,
    encoding: "utf8",
  }),
);
for (const image of info.images ?? []) {
  if (image["image-path"] !== imagePath) continue;
  const whole = image["system-entities"]?.find(
    (entity) =>
      entity["content-hint"] === "GUID_partition_scheme" &&
      /^\/dev\/disk[0-9]+$/.test(entity["dev-entry"]),
  );
  if (whole)
    try {
      execFileSync("/usr/sbin/diskutil", ["eject", whole["dev-entry"]], {
        stdio: "inherit",
      });
    } catch {
      // This is an OS-identified attachment of our disposable, read-only image.
      execFileSync(
        "/usr/sbin/diskutil",
        ["unmountDisk", "force", whole["dev-entry"]],
        { stdio: "inherit" },
      );
      execFileSync("/usr/sbin/diskutil", ["eject", whole["dev-entry"]], {
        stdio: "inherit",
      });
    }
}
let mount;
let backingDisk;
try {
  const attached = execFileSync(
    "/usr/sbin/diskutil",
    ["image", "attach", "--nobrowse", "--readOnly", imagePath],
    { encoding: "utf8" },
  );
  console.log(attached);
  backingDisk = attached.match(
    /^(\/dev\/disk[0-9]+)\s+GUID_partition_scheme/m,
  )?.[1];
  mount = attached
    .match(/^\/dev\/disk[0-9]+s[0-9]+\s+Apple_APFS_Volume\s+(.+)$/m)?.[1]
    ?.trim();
  if (!mount || !backingDisk)
    throw new Error("Could not identify the mounted artifact");
  if (!existsSync(join(mount, "Creator Desk.app/Contents/MacOS/Creator Desk")))
    throw new Error("Application missing from mounted image");
  if (readlinkSync(join(mount, "Applications")) !== "/Applications")
    throw new Error("Applications shortcut is missing");
  mkdirSync(".cache/installed-v02", { recursive: true });
  cpSync(
    join(mount, "Creator Desk.app"),
    resolve(".cache/installed-v02/Creator Desk.app"),
    { recursive: true, verbatimSymlinks: true },
  );
  execFileSync(
    "/usr/bin/codesign",
    [
      "--verify",
      "--deep",
      "--strict",
      resolve(".cache/installed-v02/Creator Desk.app"),
    ],
    { stdio: "inherit" },
  );
  const digest = (path) =>
    createHash("sha256").update(readFileSync(path)).digest("hex");
  const suffix = "Creator Desk.app/Contents/Resources/app.asar";
  const sourceHash = digest(resolve("out/Creator Desk-darwin-arm64", suffix));
  const copyHash = digest(resolve(".cache/installed-v02", suffix));
  if (sourceHash !== copyHash)
    throw new Error("Installed application content mismatch");
  writeFileSync(
    ".cache/image-verification.json",
    JSON.stringify(
      {
        mounted: true,
        applicationsShortcut: true,
        signatureVerified: true,
        appAsarSHA256: copyHash,
        copiedApplication: resolve(".cache/installed-v02/Creator Desk.app"),
      },
      null,
      2,
    ),
  );
  console.log(
    "Mounted image, copied application, verified signature and matching app content.",
  );
} finally {
  if (backingDisk)
    execFileSync("/usr/sbin/diskutil", ["eject", backingDisk], {
      stdio: "inherit",
    });
}
