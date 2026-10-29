// Dependency lifecycle scripts stay disabled. Run only the reviewed Electron downloader.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
execFileSync(process.execPath, ["node_modules/electron/install.js"], {
  stdio: "inherit",
  env: { ...process.env, electron_config_cache: resolve(".cache/electron") },
});
