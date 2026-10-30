import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  safeStorage,
  shell,
} from "electron";
import { join, resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  CoreError,
  errorResult,
  restoreInput,
  type Result,
} from "../shared/contracts";
import { closeSync, readSync } from "node:fs";
import { openRegularFile } from "./storage/files";
import { CredentialVault } from "./credentials";
import { dailySyncInput } from "../shared/youtube";
import { YouTube } from "./youtube/service";
import { Store } from "./storage/store";
import { Backups } from "./storage/backups";
import { Reports } from "./imports/reports";
import { commitImportInput, dashboardInput } from "../shared/analytics";

app.setName("Creator Desk");
const customData = process.env.CREATOR_DESK_DATA_DIR;
if (customData) {
  if (!isAbsolute(customData))
    throw new Error("Test data path must be absolute");
  app.setPath("userData", resolve(customData));
}
const locked = app.requestSingleInstanceLock();
let window: BrowserWindow | null = null;
let store: Store;
let backups: Backups;
let reports: Reports;
let youtube: YouTube;
const rendererPath = join(__dirname, "../renderer/index.html");
const rendererURL = pathToFileURL(rendererPath).href;
let operations: Promise<unknown> = Promise.resolve();
let closing = false;
let shutdownReady = false;

function handle(
  name: string,
  schema: z.ZodType,
  operation: (input: unknown) => unknown,
) {
  ipcMain.handle(`core:${name}`, (event, input: unknown) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== rendererURL
    )
      return errorResult(
        new CoreError("INVALID_INPUT", "This operation is unavailable."),
      );
    const next = operations.then(async (): Promise<Result<unknown>> => {
      try {
        if (closing) throw new CoreError("CANCELLED", "The app is closing.");
        const parsed = schema.parse(input);
        return { ok: true, value: await operation(parsed) };
      } catch (error) {
        return errorResult(error);
      }
    });
    operations = next;
    return next;
  });
}
function configureIPC() {
  handle("getYouTube", z.undefined(), () => youtube.state());
  handle("connectYouTube", z.undefined(), () => youtube.connect());
  handle("cancelYouTube", z.undefined(), () => youtube.cancel());
  handle("disconnectYouTube", z.undefined(), () => youtube.disconnect());
  handle("syncYouTubeDaily", dailySyncInput, (input) =>
    youtube.syncDaily(dailySyncInput.parse(input)),
  );
  handle("syncYouTubeUploads", z.undefined(), () => youtube.syncUploads());
  handle("syncYouTube", z.undefined(), () => youtube.sync());
  handle("importYouTubeClient", z.undefined(), async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "Import Google Desktop app credentials",
      properties: ["openFile"],
      filters: [{ name: "Google credentials JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    try {
      const fd = openRegularFile(result.filePaths[0], 64000);
      try {
        const buffer = Buffer.alloc(64001);
        let size = 0;
        while (size < buffer.length) {
          const n = readSync(fd, buffer, size, buffer.length - size, null);
          if (!n) break;
          size += n;
        }
        if (size > 64000) throw new Error("Oversized credentials");
        return youtube.configure(
          JSON.parse(buffer.subarray(0, size).toString("utf8")),
        );
      } finally {
        closeSync(fd);
      }
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError(
        "INVALID_INPUT",
        "Choose the original JSON credentials downloaded for a Google Desktop app client (under 64 KB).",
      );
    }
  });
  handle("getDashboard", dashboardInput, (input) => reports.dashboard(input));
  handle("inspectImport", z.undefined(), async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "Import channel report",
      properties: ["openFile"],
      filters: [{ name: "CSV or JSON report", extensions: ["csv", "json"] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      reports.cancel();
      return null;
    }
    return reports.inspect(result.filePaths[0]);
  });
  handle("commitImport", commitImportInput, (input) => reports.commit(input));
  handle("cancelImport", z.undefined(), () => {
    reports.cancel();
    return null;
  });
  handle("getState", z.undefined(), () => ({
    ...store.state(),
    version: app.getVersion(),
  }));
  handle("createWorkspace", z.unknown(), (input) => store.create(input));
  handle("selectWorkspace", z.unknown(), (input) => store.select(input));
  handle("renameWorkspace", z.unknown(), (input) => store.rename(input));
  handle("updateAppearance", z.unknown(), (input) => {
    const result = store.setAppearance(input);
    nativeTheme.themeSource = result.appearance;
    return result;
  });
  handle("updateSidebar", z.unknown(), (input) => store.setSidebar(input));
  handle("openDataFolder", z.undefined(), async () => {
    const error = await shell.openPath(store.root);
    if (error)
      throw new CoreError(
        "STORAGE_UNAVAILABLE",
        "The data folder could not be opened.",
      );
    return null;
  });
  handle("exportBackup", z.undefined(), async () => {
    const result = await dialog.showSaveDialog(window!, {
      title: "Export all workspaces",
      defaultPath: `Creator Desk ${new Date().toISOString().slice(0, 10)}.creatorbackup`,
      filters: [{ name: "Creator Desk backup", extensions: ["creatorbackup"] }],
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    await backups.export(result.filePath);
    return { cancelled: false };
  });
  handle("inspectRestore", z.undefined(), async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "Choose a Creator Desk backup",
      properties: ["openFile"],
      filters: [{ name: "Creator Desk backup", extensions: ["creatorbackup"] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      reports.cancel();
      backups.cancel();
      return null;
    }
    return backups.inspect(result.filePaths[0]);
  });
  handle("confirmRestore", restoreInput, async (input) => {
    const { previewId } = restoreInput.parse(input);
    reports.cancel();
    youtube.cancelAll();
    const state = await backups.restore(previewId);
    nativeTheme.themeSource = state.appearance;
    return state;
  });
  handle("cancelRestore", z.undefined(), () => {
    backups.cancel();
    return null;
  });
}
function openWindow() {
  const bounds = z
    .object({
      width: z.number().min(960).max(2560),
      height: z.number().min(640).max(1800),
    })
    .safeParse(store.setting("windowBounds", null));
  window = new BrowserWindow({
    ...(bounds.success ? bounds.data : { width: 1280, height: 820 }),
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#141b1b" : "#f6f6f2",
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset" as const }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.on("ready-to-show", () => window?.show());
  window.on("close", (event) => {
    if (shutdownReady) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    youtube.cancelAll();
    void operations.finally(() => {
      try {
        if (window && !window.isMaximized() && !window.isFullScreen()) {
          const { width, height } = window.getBounds();
          store.saveWindowBounds({ width, height });
        }
      } catch {
        dialog.showErrorBox(
          "Window settings could not be saved",
          "Your workspace data is preserved. Check disk space before opening the app again.",
        );
      }
      reports.cancel();
      backups.cancel();
      shutdownReady = true;
      window?.close();
    });
  });
  window.on("closed", () => {
    window = null;
  });
  void window.loadFile(rendererPath);
}
if (!locked) app.quit();
else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });
  app.whenReady().then(() => {
    try {
      store = new Store(app.getPath("userData"));
      backups = new Backups(store);
      reports = new Reports(store);
      const vault = new CredentialVault(store.root, {
        isEncryptionAvailable: () =>
          safeStorage.isEncryptionAvailable() &&
          (process.platform !== "linux" ||
            safeStorage.getSelectedStorageBackend() !== "basic_text"),
        encryptString: (value) => safeStorage.encryptString(value),
        decryptString: (value) => safeStorage.decryptString(value),
      });
      youtube = new YouTube(store, vault, (url) => shell.openExternal(url));
      nativeTheme.themeSource = store.state().appearance;
      session.defaultSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
        callback({
          cancel:
            !details.url.startsWith("file:") &&
            !details.url.startsWith("devtools:"),
        }),
      );
      configureIPC();
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          { role: "editMenu" },
          {
            label: "View",
            submenu: [
              { role: "resetZoom" },
              { role: "zoomIn" },
              { role: "zoomOut" },
              { type: "separator" },
              { role: "togglefullscreen" },
            ],
          },
          { role: "windowMenu" },
          {
            role: "help",
            submenu: [
              {
                label: "About this preview",
                click: () => {
                  void dialog.showMessageBox({
                    message: "Creator Desk — imported channel analytics",
                    detail:
                      "Import CSV/JSON reports, connect read-only YouTube channel totals in Settings, and back up your data. Research and AI tools are planned.",
                  });
                },
              },
            ],
          },
        ]),
      );
      openWindow();
    } catch (error) {
      const result = errorResult(error);
      dialog.showErrorBox(
        "Creator Desk could not open",
        result.ok ? "" : result.error.message,
      );
      app.quit();
    }
  });
  app.on("activate", () => {
    if (!window && store) {
      closing = false;
      shutdownReady = false;
      openWindow();
    }
  });
  app.on("before-quit", (event) => {
    if (!shutdownReady && window) {
      event.preventDefault();
      window.close();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => store?.close());
}
