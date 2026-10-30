import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { DesktopCore } from "../../src/shared/contracts";
const require = createRequire(import.meta.url);
const executablePath =
  process.env.CREATOR_DESK_TEST_EXECUTABLE || (require("electron") as string);
const root = resolve(".");
let app: ElectronApplication;
let page: Page;
let data: string;
const consoleErrors: string[] = [];
async function launch() {
  app = await electron.launch({
    executablePath,
    args: process.env.CREATOR_DESK_TEST_EXECUTABLE ? [] : [root],
    env: { ...process.env, CREATOR_DESK_DATA_DIR: data },
  });
  page = await app.firstWindow();
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await expect(
    page.getByRole("heading", {
      name: /Make room for your next idea|Channel overview/,
    }),
  ).toBeVisible();
}
test.beforeEach(async () => {
  mkdirSync(".cache", { recursive: true });
  data = mkdtempSync(resolve(".cache/e2e-"));
  consoleErrors.length = 0;
  await launch();
});
test.afterEach(async () => {
  if (app) await app.close();
  expect(consoleErrors).toEqual([]);
  rmSync(data, { recursive: true, force: true });
});
async function create(name: string) {
  await page.getByLabel("Workspace name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bring your channel into focus." }),
  ).toBeVisible();
}
test("offline onboarding, settings and workspace selection survive restart", async () => {
  const runtime = await app.evaluate(() => ({
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
  }));
  writeFileSync("test-results/runtime.json", JSON.stringify(runtime, null, 2));
  await page.screenshot({ path: "test-results/welcome.png" });
  await create("Mad Mallards Adventures");
  await page.getByLabel("Settings", { exact: true }).click();
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("Mad Mallards — Montréal");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toContainText("Workspace name saved");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "New workspace", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Workspace name").fill("Second channel");
  await modal
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await page
    .getByLabel("Current workspace")
    .selectOption({ label: "Mad Mallards — Montréal" });
  await app.close();
  await launch();
  await page.getByLabel("Settings", { exact: true }).click();
  await expect(page.getByLabel("Workspace name")).toHaveValue(
    "Mad Mallards — Montréal",
  );
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Current workspace").locator("option"),
  ).toHaveCount(2);
  await page.screenshot({ path: "test-results/settings-dark.png" });
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Light", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/settings-light.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setBounds({ width: 960, height: 640 }),
  );
  await expect(page.locator(".main-footer")).toBeInViewport();
  await page.screenshot({ path: "test-results/settings-compact.png" });
  await expect(
    page.getByRole("button", { name: "Choose backup" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await expect(page.getByText("Planned", { exact: true })).toBeVisible();
});
test("backup preview, cancellation, restore and restart use real SQLite data", async () => {
  await create("Original workspace");
  const path = join(data, "roundtrip.creatorbackup");
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, path);
  await page.getByLabel("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Backup export finished",
  );
  expect(JSON.parse(readFileSync(path, "utf8")).workspaces[0].name).toBe(
    "Original workspace",
  );
  await page.getByLabel("Workspace name").fill("Newer workspace");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toContainText("Workspace name saved");
  await page.getByRole("button", { name: "Choose backup" }).click();
  await expect(page.getByRole("dialog")).toContainText("Original workspace");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("Workspace name")).toHaveValue(
    "Newer workspace",
  );
  await page.getByRole("button", { name: "Choose backup" }).click();
  await page.getByRole("button", { name: "Restore all data" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await app.close();
  await launch();
  await page.getByLabel("Settings", { exact: true }).click();
  await expect(page.getByLabel("Workspace name")).toHaveValue(
    "Original workspace",
  );
});
test("renderer is sandboxed with a narrow API and rejects invalid input", async () => {
  const exposed = await page.evaluate(() => ({
    node: typeof (globalThis as unknown as { require: unknown }).require,
    keys: Object.keys(window.desktop),
    runtime: window.desktop.runtime,
  }));
  expect(exposed.runtime).toEqual({ sandboxed: true, contextIsolated: true });
  expect(exposed.node).toBe("undefined");
  expect(exposed.keys).not.toContain("invoke");
  const invalid = await page.evaluate(() =>
    (window.desktop as DesktopCore).createWorkspace({ name: "" }),
  );
  expect(invalid.ok).toBe(false);
  const state = await page.evaluate(() => window.desktop.getState());
  expect(state.ok && state.value.workspaces).toEqual([]);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(csp).toContain("connect-src 'none'");
});

test("a second launch focuses the existing instance", async () => {
  await create("Single instance workspace");
  const child = spawn(
    executablePath,
    process.env.CREATOR_DESK_TEST_EXECUTABLE ? [] : [root],
    { env: { ...process.env, CREATOR_DESK_DATA_DIR: data }, stdio: "ignore" },
  );
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Second launch did not exit"));
    }, 10000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  expect(exitCode).toBe(0);
  expect(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Bring your channel into focus." }),
  ).toBeVisible();
});

test("imports real CSV snapshots, explores metrics and preserves data across restart", async () => {
  await create("Import test channel");
  async function choose(file: string) {
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      },
      resolve("tests/fixtures", file),
    );
    await page
      .getByRole("button", { name: "Import report", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  async function saveVideo() {
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Channel / report label").fill("Fixture channel");
    await modal.getByLabel("Start date", { exact: true }).fill("2026-10-01");
    await modal.getByLabel("End date", { exact: true }).fill("2026-10-28");
    await modal
      .getByRole("button", { name: "Import report", exact: true })
      .click();
    await expect(modal).not.toBeVisible();
  }
  await choose("videos.csv");
  await expect(page.getByRole("dialog")).toContainText("2 video records");
  await saveVideo();
  await expect(page.locator(".metric").first()).toContainText("1,500");
  await expect(page.locator(".analytics-table tbody tr")).toHaveCount(2);
  await page.screenshot({ path: "test-results/imported-videos.png" });
  await page.getByLabel("Search report").fill("honest");
  await expect(page.locator(".analytics-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".metric").first()).toContainText("500");
  await page.getByLabel("Search report").fill("");
  await expect(page.locator(".analytics-table tbody tr")).toHaveCount(2);
  await choose("videos.csv");
  await saveVideo();
  await expect(page.locator(".dashboard-notice")).toContainText(
    "already imported",
  );
  await expect(page.getByLabel("Saved report").locator("option")).toHaveCount(
    1,
  );
  await choose("daily.csv");
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Start date", { exact: true })).toHaveValue(
    "2026-10-01",
  );
  await modal
    .getByRole("button", { name: "Import report", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator(".metric").first()).toContainText("350");
  await expect(page.getByLabel("Saved report").locator("option")).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("img", { name: /Daily views from/ }),
  ).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill("2026-10-02");
  await expect(page.locator(".metric").first()).toContainText("250");
  await expect(page.locator(".analytics-table tbody tr")).toHaveCount(2);
  await page.screenshot({ path: "test-results/imported-daily.png" });
  await page.getByLabel("From", { exact: true }).fill("2027-01-01");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(
    "2027-01-01",
  );
  await expect(page.locator(".metric").first()).toContainText("—");
  await expect(page.getByRole("alert")).not.toBeVisible();
  await page.getByRole("button", { name: "Reset dates", exact: true }).click();
  await expect(page.locator(".metric").first()).toContainText("350");
  await app.close();
  await launch();
  await expect(page.locator(".metric").first()).toContainText("350");
  await expect(page.getByLabel("Saved report").locator("option")).toHaveCount(
    2,
  );
  const backupFile = join(data, "analytics.creatorbackup");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, backupFile);
  await page.getByLabel("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Backup export finished",
  );
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "New workspace", exact: true })
    .click();
  const createModal = page.getByRole("dialog");
  await createModal.getByLabel("Workspace name").fill("Isolated workspace");
  await createModal
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bring your channel into focus." }),
  ).toBeVisible();
  await expect(page.getByLabel("Saved report")).not.toBeVisible();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, backupFile);
  await page.getByLabel("Settings", { exact: true }).click();
  await page
    .getByRole("button", { name: "Choose backup", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore all data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.locator(".metric").first()).toContainText("350");
  await expect(page.getByLabel("Saved report").locator("option")).toHaveCount(
    2,
  );
});

test("YouTube setup rejects invalid credentials and cached channel totals survive restart", async () => {
  await create("YouTube workspace");
  await page.getByLabel("Settings", { exact: true }).click();
  const connection = page.getByRole("region", { name: "YouTube connection" });
  await expect(
    connection.getByText("Read-only access to your channel."),
  ).toBeVisible();
  const file = join(data, "invalid-client.json");
  writeFileSync(file, JSON.stringify({ web: { client_id: "wrong-client" } }));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await connection
    .getByRole("button", { name: "Import Google credentials" })
    .click();
  await expect(connection.getByRole("alert")).toContainText("Desktop app");
  expect(await page.evaluate(() => window.desktop.getYouTube())).toMatchObject({
    ok: true,
    value: { configured: false, connected: false },
  });
  await app.close();
  const db = new DatabaseSync(join(data, "creator.db"));
  const id = JSON.parse(
    String(
      db
        .prepare("SELECT value FROM settings WHERE key='selectedWorkspaceId'")
        .get()!.value,
    ),
  );
  db.prepare("INSERT INTO settings VALUES(?,?)").run(
    `youtube-snapshot-${id}`,
    JSON.stringify({
      id: "UC1234567890123456789012",
      title: "Cached channel fixture",
      views: 12345,
      subscribers: null,
      videos: 7,
      syncedAt: "2026-10-28T12:00:00.000Z",
    }),
  );
  db.close();
  await launch();
  const cached = page.getByRole("region", { name: "YouTube connection" });
  await expect(cached.getByText("Cached channel fixture")).toBeVisible();
  await expect(cached.getByText("12,345", { exact: true })).toBeVisible();
  await expect(cached.getByText("Unavailable", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/youtube-cache.png" });
});

test("synchronizes daily analytics and uploads through the protected main-process bridge", async () => {
  await create("Live sync fixture");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setBounds({ width: 960, height: 640 }),
  );
  const state = await page.evaluate(() => window.desktop.getState());
  if (!state.ok) throw new Error("State unavailable");
  const id = state.value.selectedWorkspaceId!;
  const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ];
  const client = {
    client_id: "fixture.apps.googleusercontent.com",
    client_secret: "fixture-only",
  };
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64");
  writeFileSync(
    join(data, "credentials.json"),
    JSON.stringify({
      "youtube-client": encode(client),
      [`youtube-${id}`]: encode({
        client,
        tokens: {
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          expiresAt: Date.now() + 3600000,
          scopes,
        },
      }),
    }),
  );
  await app.evaluate(({ safeStorage }) => {
    // Isolated synthetic credentials: no OS keyring or actual Google access is used by this test.
    safeStorage.isEncryptionAvailable = () => true;
    safeStorage.getSelectedStorageBackend = () => "gnome_libsecret";
    safeStorage.decryptString = (value) => value.toString();
    safeStorage.encryptString = (value) => Buffer.from(value);
    globalThis.fetch = async (raw) => {
      const url = new URL(String(raw));
      const channel = "UC1234567890123456789012";
      if (url.hostname === "youtubeanalytics.googleapis.com")
        return Response.json({
          columnHeaders: [
            "day",
            "views",
            "estimatedMinutesWatched",
            "subscribersGained",
            "subscribersLost",
          ].map((name, i) => ({
            name,
            columnType: i ? "METRIC" : "DIMENSION",
            dataType: i ? "INTEGER" : "STRING",
          })),
          rows: [
            ["2026-01-01", 100, 120, 5, 1],
            ["2026-01-03", 50, 60, 0, 2],
          ],
        });
      if (url.hostname !== "www.googleapis.com")
        throw new Error("Unexpected test endpoint");
      if (url.pathname.endsWith("/channels"))
        return Response.json({
          items: [
            url.searchParams.get("part") === "contentDetails"
              ? {
                  id: channel,
                  contentDetails: {
                    relatedPlaylists: { uploads: "UUfixture" },
                  },
                }
              : {
                  id: channel,
                  snippet: { title: "Fixture channel" },
                  statistics: {
                    viewCount: "999",
                    subscriberCount: "50",
                    videoCount: "1",
                  },
                },
          ],
        });
      if (url.pathname.endsWith("/playlistItems"))
        return Response.json({
          items: [{ contentDetails: { videoId: "abcdefghijk" } }],
        });
      if (url.pathname.endsWith("/videos"))
        return Response.json({
          items: [
            {
              id: "abcdefghijk",
              snippet: {
                channelId: channel,
                title: "Fixture upload",
                publishedAt: "2026-01-02T12:00:00Z",
              },
              statistics: { viewCount: "99" },
            },
          ],
        });
      throw new Error("Unexpected test endpoint");
    };
  });
  await page.getByLabel("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const connection = page.getByRole("region", { name: "YouTube connection" });
  await connection.getByLabel("Report from").fill("2026-01-01");
  await connection.getByLabel("Report to").fill("2026-01-03");
  await connection
    .getByRole("button", { name: "Sync daily analytics", exact: true })
    .click();
  await expect(
    page.getByText("YouTube API snapshot", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Saved report")).toContainText(
    "YouTube daily analytics",
  );
  const dashboard = await page.evaluate(() => window.desktop.getDashboard({}));
  if (!dashboard.ok) throw new Error("Report missing");
  expect(dashboard.value.totals).toMatchObject({
    views: 150,
    watchHours: 3,
    subscribers: 2,
    impressions: null,
  });
  expect(dashboard.value.series).toHaveLength(2);
  await connection
    .getByRole("button", { name: "Sync uploads", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Fixture upload abcdefghijk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("YouTube API snapshot", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/youtube-reports.png" });
  await app.close();
  await launch();
  await expect(
    page.getByRole("cell", { name: "Fixture upload abcdefghijk", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Saved report")
    .selectOption(dashboard.value.selected!.id);
  await expect(
    page.getByText("YouTube API snapshot", { exact: true }),
  ).toBeVisible();
});
