const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const electronVersion = require("electron/package.json").version;
const archiveName = `electron-v${electronVersion}-darwin-arm64.zip`;
const cache = path.join(__dirname, ".cache/electron");
const candidate = fs.existsSync(cache)
  ? fs
      .readdirSync(cache, { recursive: true })
      .find((name) => path.basename(name) === archiveName)
  : undefined;
let electronZipDir;
if (candidate) {
  const archive = path.join(cache, candidate);
  const expected = require("electron/checksums.json")[archiveName];
  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(archive))
    .digest("hex");
  if (!expected || actual !== expected)
    throw new Error("Cached Electron archive checksum mismatch.");
  electronZipDir = path.dirname(archive);
}
module.exports = {
  packagerConfig: {
    asar: true,
    electronZipDir,
    icon: require("node:path").join(__dirname, "assets/CreatorDesk.icns"),
    appBundleId: "local.creatordesk.desktop",
    appCategoryType: "public.app-category.video",
    executableName: "Creator Desk",
    name: "Creator Desk",
    download: {
      cacheRoot: require("node:path").join(__dirname, ".cache/electron"),
    },
    ignore: [
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/tasks($|\/)/,
      /^\/docs($|\/)/,
      /^\/scripts($|\/)/,
      /^\/\.cache($|\/)/,
      /^\/test-results($|\/)/,
      /\.config\.(ts|mjs|cjs)$/,
      /^\/tsconfig.json$/,
      /^\/\.npmrc$/,
    ],
  },
  makers: [{ name: "@electron-forge/maker-zip", platforms: ["darwin"] }],
};
