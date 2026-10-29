import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
if (process.platform !== "darwin" || process.argv.includes("--arch=x64"))
  throw new Error("This release script currently supports macOS arm64.");
execFileSync(
  process.execPath,
  [
    "node_modules/@electron-forge/cli/dist/electron-forge.js",
    "make",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
const application = resolve("out/Creator Desk-darwin-arm64/Creator Desk.app");
// Ad-hoc signing makes the local artifact self-consistent; this is not Developer ID signing.
execFileSync(
  "/usr/bin/codesign",
  ["--force", "--deep", "--sign", "-", application],
  { stdio: "inherit" },
);
// Re-create the ZIP from the signed app; Forge's first ZIP predates this signing step.
const output = resolve("out/make");
mkdirSync(output, { recursive: true });
execFileSync(
  "/usr/bin/ditto",
  [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    application,
    join(output, `Creator-Desk-${version}-mac-arm64.zip`),
  ],
  { stdio: "inherit" },
);
execFileSync(process.execPath, ["scripts/dmg.mjs"], { stdio: "inherit" });
