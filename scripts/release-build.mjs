import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  chmodSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { releaseTarget } from "./release-policy.mjs";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const arch =
  process.argv.find((s) => s.startsWith("--arch="))?.split("=")[1] ||
  process.env.CREATOR_DESK_ARCH ||
  process.arch;
const target = releaseTarget(process.platform, arch, version);
if (arch !== process.arch)
  throw new Error("Build and test on the native architecture.");
const output = resolve("out/make");
mkdirSync(output, { recursive: true });
mkdirSync(".cache", { recursive: true });
execFileSync(
  process.execPath,
  [
    "node_modules/@electron-forge/cli/dist/electron-forge.js",
    "package",
    `--arch=${arch}`,
  ],
  { stdio: "inherit", env: { ...process.env, CREATOR_DESK_ARCH: arch } },
);
if (process.platform === "darwin") {
  execFileSync(
    "/usr/bin/codesign",
    ["--force", "--deep", "--sign", "-", target.application],
    { stdio: "inherit" },
  );
  execFileSync(
    "/usr/bin/ditto",
    [
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      target.application,
      join(output, `${target.prefix}.zip`),
    ],
    { stdio: "inherit" },
  );
  execFileSync(process.execPath, ["scripts/dmg.mjs"], {
    stdio: "inherit",
    env: { ...process.env, CREATOR_DESK_ARCH: arch },
  });
} else if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath $env:CREATOR_DESK_PACKAGE_DIR -DestinationPath $env:CREATOR_DESK_ZIP -CompressionLevel Optimal -Force",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CREATOR_DESK_PACKAGE_DIR: target.application,
        CREATOR_DESK_ZIP: join(output, `${target.prefix}.zip`),
      },
    },
  );
  const compiler =
    process.env.ISCC_PATH ||
    join(
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
      "Inno Setup 6",
      "ISCC.exe",
    );
  if (!existsSync(compiler))
    throw new Error("Install Inno Setup 6 or set ISCC_PATH.");
  execFileSync(
    compiler,
    [
      `/DAppDir=${target.application}`,
      `/DVersion=${version}`,
      `/DOutputDir=${output}`,
      `/DIconFile=${resolve("assets/CreatorDesk.ico")}`,
      resolve("packaging/windows.iss"),
    ],
    { stdio: "inherit" },
  );
} else {
  const root = mkdtempSync(resolve(".cache/deb-"));
  try {
    const app = join(root, "opt/creator-desk");
    cpSync(target.application, app, {
      recursive: true,
      verbatimSymlinks: true,
    });
    chmodSync(join(app, "chrome-sandbox"), 0o4755);
    mkdirSync(join(root, "DEBIAN"));
    mkdirSync(join(root, "usr/share/applications"), { recursive: true });
    mkdirSync(join(root, "usr/share/icons/hicolor/256x256/apps"), {
      recursive: true,
    });
    cpSync(
      "assets/CreatorDesk.png",
      join(root, "usr/share/icons/hicolor/256x256/apps/creator-desk.png"),
    );
    writeFileSync(
      join(root, "DEBIAN/control"),
      `Package: creator-desk\nVersion: ${version}\nArchitecture: amd64\nMaintainer: Creator Desk <noreply@localhost>\nSection: video\nPriority: optional\nDepends: libgtk-3-0t64 | libgtk-3-0, libnss3, libasound2t64 | libasound2, libgbm1, libxss1, libxtst6, libatk-bridge2.0-0t64 | libatk-bridge2.0-0, libdrm2\nDescription: Local creator workspace and imported channel analytics\n`,
    );
    writeFileSync(
      join(root, "usr/share/applications/creator-desk.desktop"),
      "[Desktop Entry]\nType=Application\nName=Creator Desk\nExec=/opt/creator-desk/creator-desk %U\nIcon=creator-desk\nTerminal=false\nCategories=AudioVideo;Video;\n",
    );
    execFileSync(
      "dpkg-deb",
      [
        "--build",
        "--root-owner-group",
        root,
        join(output, `${target.prefix}.deb`),
      ],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
writeFileSync(
  resolve(".cache/release-target.json"),
  JSON.stringify(target, null, 2),
);
console.log("Created release assets:", target.assets.join(", "));
