import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  appendFileSync,
  readFileSync,
  cpSync,
  mkdtempSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { releaseTarget } from "./release-policy.mjs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const target = releaseTarget(process.platform, process.arch, version);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
mkdirSync(".cache", { recursive: true });
const destination = mkdtempSync(resolve(".cache/installed-"));
let executable;
if (process.platform === "darwin") {
  const mount = join(destination, "volume");
  mkdirSync(mount);
  run("hdiutil", [
    "attach",
    "-nobrowse",
    "-readonly",
    "-mountpoint",
    mount,
    resolve("out/make", target.assets[0]),
  ]);
  try {
    const app = join(destination, "Creator Desk.app");
    cpSync(join(mount, "Creator Desk.app"), app, {
      recursive: true,
      verbatimSymlinks: true,
    });
    run("codesign", ["--verify", "--deep", "--strict", app]);
    executable = join(app, "Contents/MacOS/Creator Desk");
  } finally {
    run("hdiutil", ["detach", mount]);
  }
} else if (process.platform === "win32") {
  run(resolve("out/make", target.assets[0]), [
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/SP-",
    `/DIR=${destination}`,
  ]);
  executable = join(destination, "creator-desk.exe");
} else {
  run("sudo", ["dpkg", "-i", resolve("out/make", target.assets[0])]);
  executable = "/opt/creator-desk/creator-desk";
}
if (!existsSync(executable)) throw new Error("Installed executable missing");
if (process.env.GITHUB_ENV)
  appendFileSync(
    process.env.GITHUB_ENV,
    `CREATOR_DESK_TEST_EXECUTABLE=${executable}\n`,
  );
console.log(`Installed application: ${executable}`);
