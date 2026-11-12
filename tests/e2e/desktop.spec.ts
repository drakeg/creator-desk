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
  await page.getByLabel("Channel name", { exact: true }).fill(name);
  await page
    .locator("#main-content")
    .getByRole("button", { name: "Add channel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connect your YouTube channel" }),
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
    .getByLabel("Channel name", { exact: true })
    .fill("Mad Mallards — Montréal");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toContainText("Channel name saved");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add channel", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Channel name").fill("Second channel");
  await modal.getByRole("button", { name: "Add channel", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await page
    .getByLabel("Current channel")
    .selectOption({ label: "Mad Mallards — Montréal" });
  await app.close();
  await launch();
  await page.getByLabel("Settings", { exact: true }).click();
  await expect(page.getByLabel("Channel name")).toHaveValue(
    "Mad Mallards — Montréal",
  );
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Current channel").locator("option"),
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
  await expect(
    page.locator(".module-banner").getByText("Planned", { exact: true }),
  ).toBeVisible();
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
  await page.getByLabel("Channel name").fill("Newer workspace");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toContainText("Channel name saved");
  await page.getByRole("button", { name: "Choose backup" }).click();
  await expect(page.getByRole("dialog")).toContainText("Original workspace");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("Channel name")).toHaveValue("Newer workspace");
  await page.getByRole("button", { name: "Choose backup" }).click();
  await page.getByRole("button", { name: "Restore all data" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await app.close();
  await launch();
  await page.getByLabel("Settings", { exact: true }).click();
  await expect(page.getByLabel("Channel name")).toHaveValue(
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
    page.getByRole("heading", { name: "Connect your YouTube channel" }),
  ).toBeVisible();
});

test("imports real CSV snapshots, explores metrics and preserves data across restart", async () => {
  await create("Import test channel");
  await page
    .getByRole("button", { name: "Saved reports & imports", exact: true })
    .click();
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
  await expect(
    page.getByRole("columnheader", { name: "Impressions" }),
  ).toBeVisible();
  await expect(page.locator(".analytics-table tbody tr").first()).toContainText(
    "15,000",
  );
  await page.getByRole("button", { name: "Impressions", exact: true }).click();
  await expect(page.locator(".analytics-table tbody tr").first()).toContainText(
    "15,000",
  );
  await expect(page.locator(".analytics-table tbody tr").first()).toContainText(
    "1:05",
  );
  await expect(page.locator(".analytics-table tbody tr").first()).toContainText(
    "6.25",
  );
  await page.getByRole("button", { name: "CTR (%)", exact: true }).click();
  await expect(page.locator(".analytics-table tbody tr").first()).toContainText(
    "1:02:03",
  );
  await page.getByRole("button", { name: "Views", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage reports", exact: true })
    .click();
  await page.getByLabel("Report name", { exact: true }).fill("Autumn review");
  await page
    .getByRole("button", { name: "Save report name", exact: true })
    .click();
  await expect(page.getByLabel("Saved report")).toContainText("Autumn review");
  await page
    .getByRole("button", { name: "Manage reports", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete selected report", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete selected report", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete report", exact: true })
    .click();
  await expect(page.getByLabel("Saved report")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Manage reports", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore Autumn review", exact: true })
    .click();
  await expect(page.locator(".metric").first()).toContainText("1,500");
  await page
    .getByRole("button", { name: "Manage reports", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete selected report", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete report", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage reports", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Permanently remove Autumn review",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("cannot be undone");
  await page
    .getByRole("button", { name: "Remove permanently", exact: true })
    .click();
  await choose("videos.csv");
  await saveVideo();
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
  await page
    .getByRole("button", { name: "Saved reports & imports", exact: true })
    .click();
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
    .getByRole("button", { name: "Saved reports & imports", exact: true })
    .click();
  await page.getByRole("button", { name: "Add channel", exact: true }).click();
  const createModal = page.getByRole("dialog");
  await createModal.getByLabel("Channel name").fill("Isolated workspace");
  await createModal
    .getByRole("button", { name: "Add channel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connect your YouTube channel" }),
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
  await page
    .getByRole("button", { name: "Saved reports & imports", exact: true })
    .click();
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
  const beforeConnection = await page.evaluate(() =>
    window.desktop.getYouTube(),
  );
  if (beforeConnection.ok && beforeConnection.value.configured)
    await expect(
      connection.getByRole("button", { name: "Connect YouTube", exact: true }),
    ).toBeVisible();
  const guide = connection.locator("details.google-setup");
  if (!(await guide.evaluate((node) => (node as HTMLDetailsElement).open)))
    await guide.locator("summary").click();
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
    value: {
      configured: beforeConnection.ok
        ? beforeConnection.value.configured
        : false,
      connected: false,
    },
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
  const cached = page.getByRole("region", { name: "Channel history" });
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
      if (url.hostname === "youtubeanalytics.googleapis.com" &&
          url.searchParams.get("dimensions") === "elapsedVideoTimeRatio") {
        if (url.searchParams.get("filters") !== "video==abcdefghijk")
          throw new Error("Retention request must target exactly the selected video");
        return Response.json({
          columnHeaders: [
            { name: "elapsedVideoTimeRatio" },
            { name: "audienceWatchRatio" },
            { name: "relativeRetentionPerformance" },
          ],
          rows: [[0, 1.4, 0.9], [0.5, 0.75, 0.6], [1, 0.2, 0.4]],
        });
      }
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
          ].filter(
            (row) =>
              String(row[0]) >= url.searchParams.get("startDate")! &&
              String(row[0]) <= url.searchParams.get("endDate")!,
          ),
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
                  snippet: {
                    title: "Fixture channel",
                    publishedAt: "2026-01-01T00:00:00Z",
                  },
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
              contentDetails: { duration: "PT2M5S" },
            },
          ],
        });
      throw new Error("Unexpected test endpoint");
    };
  });
  await page.getByLabel("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const history = page.getByRole("region", { name: "Channel history" });
  await expect(
    history.getByText("Channel history updated and saved locally."),
  ).toBeVisible();
  const cache = await page.evaluate(() => window.desktop.getChannelHistory());
  if (!cache.ok || !cache.value) throw new Error("History missing");
  expect(cache.value.daily?.rows).toHaveLength(2);
  expect(cache.value.uploads?.rows).toHaveLength(1);
  await expect(
    page.getByRole("cell", { name: "Fixture upload abcdefghijk", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Analytics date range").selectOption("custom");
  await page.getByLabel("From", { exact: true }).fill("2026-01-02");
  await page.getByLabel("To", { exact: true }).fill("2026-01-03");
  await expect(
    page.locator(".metric-grid").getByText("50", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/youtube-reports.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setBounds({ width: 1280, height: 820 }),
  );
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.screenshot({ path: "test-results/channel-overview.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Search channel videos").fill("not present");
  await expect(
    page.getByText("No videos returned or matching this search."),
  ).toBeVisible();
  await page.getByLabel("Search channel videos").fill("");
  await page.getByRole("button", { name: "View retention for Fixture upload" }).click();
  const retention = page.getByRole("region", { name: "Audience retention analytics" });
  await expect(retention.getByRole("heading", { name: "Audience retention" })).toBeVisible();
  await expect(retention.getByLabel("Video")).toHaveValue("abcdefghijk");
  await retention.getByRole("button", { name: "Last 28 days" }).click();
  const end = await retention.getByLabel("To").inputValue();
  const recent = new Date(Date.parse(end + "T00:00:00Z") - 27 * 86400000)
    .toISOString().slice(0, 10);
  await expect(retention.getByLabel("From")).toHaveValue(recent);
  await retention.getByRole("button", { name: "Last 90 days" }).click();
  const longer = new Date(Date.parse(end + "T00:00:00Z") - 89 * 86400000)
    .toISOString().slice(0, 10);
  await expect(retention.getByLabel("From")).toHaveValue(longer);
  await retention.getByRole("button", { name: "All available history" }).click();
  await expect(retention.getByLabel("From")).toHaveValue("2026-01-01");
  await retention.getByRole("button", { name: "Refresh retention" }).click();
  await expect(retention.getByRole("img", { name: /Audience watch ratio curve/ })).toBeVisible();
  await expect(retention.getByRole("cell", { name: "140.0%" })).toBeVisible();
  await expect(retention.getByRole("columnheader", { name: "Elapsed time" })).toBeVisible();
  await expect(retention.getByRole("cell", { name: "2:05" })).toBeVisible();
  await expect(retention.getByText(/Cached locally for offline use/)).toBeVisible();
  await page.screenshot({ path: "test-results/retention-compact.png" });
  // Returning to the same tab must reopen the cached curve without a new request.
  await retention.getByRole("button", { name: "Back to channel analytics" }).click();
  await page.getByRole("button", { name: "Retention", exact: true }).click();
  await expect(page.getByRole("cell", { name: "140.0%" })).toBeVisible();
  // Native controls are reachable by keyboard even at compact window width.
  await page.getByLabel("Video", { exact: true }).focus();
  await expect(page.getByLabel("Video", { exact: true })).toBeFocused();
  // Retention must remain usable at the supported minimum window size,
  // with any horizontal scrolling contained in the chart/table instead of
  // overflowing the entire application.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setBounds({ width: 960, height: 640 }),
  );
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth
  )).toBe(true);
  await expect(retention.getByRole("img", { name: /Audience watch ratio curve/ })).toBeVisible();
  await page.screenshot({ path: "test-results/retention-light-compact.png" });

  await page.getByLabel("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dark", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Retention", exact: true }).click();
  await expect(page.getByRole("cell", { name: "140.0%" })).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth
  )).toBe(true);
  await page.screenshot({ path: "test-results/retention-dark-compact.png" });

  await page.getByLabel("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Connected channel", exact: true }).click();
  await app.evaluate(() => {
    const previous = globalThis.fetch;
    globalThis.fetch = async (raw, init) => {
      const url = new URL(String(raw));
      if (url.hostname !== "youtubereporting.googleapis.com")
        return previous(raw, init);
      const job = {
        id: "reach-job",
        reportTypeId: "channel_reach_basic_a1",
        name: "Reach",
        createTime: "2026-11-01T00:00:00Z",
      };
      if (url.pathname.endsWith("/reportTypes"))
        return Response.json({
          reportTypes: [{ id: job.reportTypeId, name: "Reach Basic" }],
        });
      if (url.pathname.endsWith("/jobs"))
        return Response.json(init?.method === "POST" ? job : { jobs: [job] });
      if (url.pathname.endsWith("/reports")) return Response.json({});
      throw new Error("Unexpected reporting request");
    };
  });
  await page.getByRole("button", { name: "Reach", exact: true }).click();
  const reach = page.getByRole("region", { name: "Reach analytics" });
  await reach
    .getByRole("button", { name: "Enable reach reporting", exact: true })
    .click();
  await expect(reach.getByText(/Waiting for YouTube reports/)).toBeVisible();
  await app.evaluate(() => {
    const previous = globalThis.fetch;
    globalThis.fetch = async (raw, init) => {
      const url = new URL(String(raw));
      if (
        url.hostname !== "youtubereporting.googleapis.com" ||
        (!url.pathname.endsWith("/reports") &&
          !url.pathname.startsWith("/v1/media/"))
      )
        return previous(raw, init);
      const first = {
        id: "reach-one",
        jobId: "reach-job",
        startTime: "2026-11-01T07:00:00Z",
        endTime: "2026-11-02T08:00:00Z",
        createTime: "2026-11-04T00:00:00Z",
        downloadUrl: "https://youtubereporting.googleapis.com/v1/media/one",
      };
      if (url.pathname.endsWith("/reports"))
        return Response.json({
          reports: [
            first,
            {
              ...first,
              id: "reach-three",
              startTime: "2026-11-03T08:00:00Z",
              endTime: "2026-11-04T08:00:00Z",
              downloadUrl:
                "https://youtubereporting.googleapis.com/v1/media/three",
            },
          ],
        });
      const header =
        "date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr";
      return new Response(
        url.pathname.endsWith("/three")
          ? header
          : header +
              "\n20261101,UC1234567890123456789012,abcdefghijk,100,10\n20261101,UC1234567890123456789012,lmnopqrstuv,900,2",
      );
    };
  });
  await reach
    .getByRole("button", { name: "Refresh reach", exact: true })
    .click();
  await expect(reach.locator(".metric").first()).toContainText("1,000");
  await expect(reach.locator(".metric").nth(1)).toContainText("2.8%");
  await reach.getByLabel("Video", { exact: true }).selectOption("abcdefghijk");
  await expect(reach.locator(".metric").first()).toContainText("100");
  await expect(reach.locator(".metric").nth(1)).toContainText("10%");
  await reach
    .getByRole("button", { name: "Reset reach filters", exact: true })
    .click();
  await reach.getByLabel("From", { exact: true }).fill("2026-11-02");
  await reach.getByLabel("To", { exact: true }).fill("2026-11-02");
  await expect(
    reach.getByText(/No downloaded reports cover this date range/),
  ).toBeVisible();
  await reach
    .getByRole("button", { name: "Reset reach filters", exact: true })
    .click();
  await page.screenshot({ path: "test-results/reach-light.png" });
  await page
    .getByRole("button", { name: "Connected channel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sync channel history", exact: true })
    .click();
  await expect(
    page.getByText("Channel and reach history updated and saved locally.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reach", exact: true }).click();
  await app.evaluate(() => {
    const previous = globalThis.fetch;
    globalThis.fetch = async (raw, init) =>
      String(raw).includes("youtubereporting.googleapis.com")
        ? Response.json({ error: {} }, { status: 403 })
        : previous(raw, init);
  });
  await reach
    .getByRole("button", { name: "Refresh reach", exact: true })
    .click();
  await expect(reach.getByRole("alert")).toContainText(
    "Enable YouTube Reporting API",
  );
  await expect(reach.locator(".metric").first()).toContainText("1,000");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Reach", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Reach analytics" })
      .locator(".metric")
      .nth(1),
  ).toContainText("2.8%");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setBounds({ width: 960, height: 640 }),
  );
  await page.screenshot({ path: "test-results/reach-dark-compact.png" });
  await app.close();
  await launch();
  await expect(
    page.getByRole("cell", { name: "Fixture upload abcdefghijk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sync channel history", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reach", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Reach analytics" })
      .locator(".metric")
      .first(),
  ).toContainText("1,000");
});

test("creates an AI-suggested vertical Short with real local media processing", async () => {
  await create("Shorts workspace");
  const { execFileSync } = await import("node:child_process");
  const ffmpeg =
    process.env.CREATOR_DESK_TEST_FFMPEG ||
    resolve(
      ".cache/tools",
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
    );
  const source = join(data, "source.mp4");
  const output = join(data, "finished-short.mp4");
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=16000",
    "-t",
    "6",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    source,
  ]);
  const { createHash } = await import("node:crypto");
  const before = createHash("sha256")
    .update(readFileSync(source))
    .digest("hex");
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  async function choose(path: string) {
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, path);
  }
  const setupArchive = resolve(
    ".cache/media-setup",
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "download.zip" : "download.tar.xz",
  );
  await app.evaluate(async (_electron, archive) => {
    const { readFileSync } = process.getBuiltinModule("node:fs");
    const bytes = readFileSync(archive);
    globalThis.fetch = async (url) => {
      if (
        !String(url).startsWith(
          "https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v8.1.3-2/",
        )
      )
        throw new Error("Unexpected setup destination");
      return new Response(bytes);
    };
  }, setupArchive);
  await page
    .getByRole("button", { name: "Set up FFmpeg", exact: true })
    .click();
  await expect(
    page.getByText("Using app-managed FFmpeg 8.1.3 (Jellyfin build, GPLv3)."),
  ).toBeVisible({ timeout: 30000 });
  await choose(source);
  await page.getByRole("button", { name: "Choose source video" }).click();
  await expect(page.getByLabel("Short title")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await app.evaluate(() => {
    let chatCalls = 0;
    globalThis.fetch = async (raw, init) => {
      const url = String(raw);
      if (url.endsWith("/audio/transcriptions")) {
        const file = (init!.body as FormData).get("file") as Blob;
        if (!file || file.size < 1000)
          throw new Error("Missing extracted audio");
        return Response.json({
          segments: [
            { start: 1, end: 3, text: "An interesting opening." },
            { start: 3, end: 5, text: "A satisfying payoff." },
          ],
        });
      }
      if (url.endsWith("/api/chat")) {
        chatCalls++;
        if (chatCalls > 1 && !String(init!.body).includes("Corrected payoff"))
          throw new Error("Expected corrected transcript");
        return Response.json({
          message: {
            content: JSON.stringify({
              clips: [
                {
                  startCue: 0,
                  endCue: 1,
                  title: "A strong moment",
                  reason: "An opening and payoff",
                  score: 90,
                },
              ],
            }),
          },
        });
      }
      if (url.endsWith("/api/tags"))
        return Response.json({ models: [{ name: "fixture-local" }] });
      throw new Error("Unexpected test endpoint");
    };
  });
  await page.evaluate(async () => {
    const a = await window.desktop.shorts.saveAI({
      config: {
        purpose: "clips",
        kind: "ollama",
        baseURL: "http://localhost:11434",
        model: "fixture-local",
        allowed: true,
      },
      apiKey: "",
    });
    if (!a.ok) throw new Error(a.error.message);
    const b = await window.desktop.shorts.saveAI({
      config: {
        purpose: "speech",
        kind: "compatible",
        baseURL: "http://localhost:8080/v1",
        model: "fixture-speech",
        allowed: true,
      },
      apiKey: "",
    });
    if (!b.ok) throw new Error(b.error.message);
  });
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await page
    .getByRole("button", { name: "Transcribe audio with selected AI" })
    .click();
  await expect(page.getByText(/2 timed cues/)).toBeVisible();
  await page
    .getByRole("button", { name: "Suggest clips with selected AI" })
    .click();
  await expect(
    page.getByRole("button", { name: "Use suggestion 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use suggestion 1" }).click();
  await expect(page.getByLabel("Short title")).toHaveValue("A strong moment");
  await page.getByText("Review timed transcript", { exact: true }).click();
  await page.getByLabel("Search transcript").fill("not present");
  await expect(
    page.getByText("No captions match this search. Try another phrase."),
  ).toBeVisible();
  await page.getByLabel("Search transcript").fill("payoff");
  await expect(page.getByText(/1 matching captions/)).toBeVisible();
  await page
    .getByRole("button", { name: "Play caption 2", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThanOrEqual(3);
  await page.locator("video").evaluate((v) => (v as HTMLVideoElement).pause());
  await page
    .getByRole("button", { name: "End clip at caption 2", exact: true })
    .click();
  await expect(page.getByLabel("End (seconds)", { exact: true })).toHaveValue(
    "5",
  );
  await page.getByLabel("Search transcript").fill("");
  await page
    .getByRole("button", { name: "Start clip at caption 1", exact: true })
    .click();
  await expect(page.getByLabel("Start (seconds)", { exact: true })).toHaveValue(
    "1",
  );
  await page
    .getByRole("button", { name: "Edit caption 2", exact: true })
    .click();
  await page
    .getByLabel("Caption text", { exact: true })
    .fill("Discard this correction");
  await page.getByLabel("Caption text", { exact: true }).press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("A satisfying payoff.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit caption 2", exact: true })
    .click();
  await page
    .getByLabel("Caption text", { exact: true })
    .fill("Corrected payoff, ready to share.");
  await page
    .getByLabel("Caption start (seconds)", { exact: true })
    .fill("3.25");
  await page.getByLabel("Caption end (seconds)", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save caption", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Enter caption text and an end time after its start.",
  );
  await page.getByLabel("Caption end (seconds)", { exact: true }).fill("4.75");
  await page.screenshot({ path: "test-results/caption-editor.png" });
  await page.getByRole("button", { name: "Save caption", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Corrected payoff, ready to share.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use suggestion 1" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Suggest clips with selected AI" })
    .click();
  await expect(
    page.getByRole("button", { name: "Use suggestion 1" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save clip draft", exact: true })
    .click();
  await page.getByLabel("Burn captions into video").check();
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, output);
  await page.getByRole("button", { name: "Export vertical MP4" }).click();
  await expect(page.getByText(/Exported finished-short.mp4/)).toBeVisible({
    timeout: 45000,
  });
  const probe = execFileSync(
    ffmpeg,
    ["-hide_banner", "-i", output, "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  void probe;
  const { spawnSync } = await import("node:child_process");
  const metadata = spawnSync(ffmpeg, ["-hide_banner", "-i", output], {
    encoding: "utf8",
  }).stderr;
  expect(metadata).toContain("720x1280");
  expect(metadata).toContain("00:00:04.");
  expect(createHash("sha256").update(readFileSync(source)).digest("hex")).toBe(
    before,
  );
  const { readdirSync } = await import("node:fs");
  const sidecar = readdirSync(data).find(
    (name) => name.startsWith("finished-short.mp4.") && name.endsWith(".srt"),
  );
  expect(sidecar).toBeTruthy();
  const captions = readFileSync(join(data, sidecar!), "utf8");
  expect(captions).toContain("Corrected payoff, ready to share.");
  expect(captions).toContain("00:00:02,250 --> 00:00:03,750");
  expect(captions).not.toContain("A satisfying payoff.");
  await page.screenshot({ path: "test-results/shorts-studio.png" });
  await app.close();
  await launch();
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await expect(page.getByLabel("Short title")).toHaveValue("A strong moment");
  await expect(
    page.getByText("Using app-managed FFmpeg 8.1.3 (Jellyfin build, GPLv3)."),
  ).toBeVisible();
  const savedTranscript = await page.evaluate(() =>
    window.desktop.shorts.get(),
  );
  expect(savedTranscript.ok && savedTranscript.value.cues[1]).toEqual({
    start: 3.25,
    end: 4.75,
    text: "Corrected payoff, ready to share.",
  });
  const transcriptFile = join(data, "many-captions.srt");
  const stamp = (ms: number) =>
    `00:00:${String(Math.floor(ms / 1000)).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  writeFileSync(
    transcriptFile,
    Array.from(
      { length: 61 },
      (_, i) =>
        `${i + 1}\n${stamp(i * 80)} --> ${stamp(i * 80 + 50)}\n${i === 50 ? "A distinctive needle caption." : "Caption content " + (i + 1)}\n`,
    ).join("\n"),
  );
  await choose(transcriptFile);
  await page
    .getByRole("button", { name: "Import SRT / VTT", exact: true })
    .click();
  await page.getByText("Review timed transcript", { exact: true }).click();
  await expect(page.locator(".transcript-cue")).toHaveCount(50);
  await page
    .getByRole("button", { name: "Next captions", exact: true })
    .click();
  await expect(page.locator(".transcript-cue")).toHaveCount(11);
  await page
    .getByRole("button", { name: "Edit caption 51", exact: true })
    .click();
  await expect(page.getByLabel("Caption text", { exact: true })).toHaveValue(
    "A distinctive needle caption.",
  );
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page.getByLabel("Search transcript").fill("distinctive needle");
  await expect(page.locator(".transcript-cue")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Edit caption 51", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 800, height: 700 });
  await page
    .getByRole("button", { name: "Edit caption 51", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save caption", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/caption-editor-small.png" });
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
});

test("Google setup displays exact URLs and opens only fixed destinations in the system browser", async () => {
  await create("Google setup");
  await page.getByLabel("Settings", { exact: true }).click();
  const connection = page.getByRole("region", { name: "YouTube connection" });
  const state = await page.evaluate(() => window.desktop.getYouTube());
  if (state.ok && state.value.configured)
    await expect(
      connection.getByRole("button", { name: "Connect YouTube", exact: true }),
    ).toBeVisible();
  const guide = connection.locator("details.google-setup");
  if (!(await guide.evaluate((node) => (node as HTMLDetailsElement).open)))
    await guide.locator("summary").click();
  await app.evaluate(({ shell }) => {
    const calls: string[] = [];
    (globalThis as unknown as { setupURLs: string[] }).setupURLs = calls;
    shell.openExternal = async (url) => {
      calls.push(url);
    };
  });
  const link = guide.getByRole("link", { name: /Enable YouTube Data API v3/ });
  await expect(link).toHaveAttribute(
    "href",
    "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  );
  await expect(link.locator("code")).toHaveText(
    "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  );
  await link.click();
  await guide
    .getByRole("link", { name: /Create a Desktop app OAuth client/ })
    .click();
  expect(
    await app.evaluate(
      () => (globalThis as unknown as { setupURLs: string[] }).setupURLs,
    ),
  ).toEqual([
    "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    "https://console.cloud.google.com/auth/clients",
  ]);
  const rejected = await page.evaluate(() =>
    window.desktop.openGoogleSetup({
      page: "https://untrusted.example" as never,
    }),
  );
  expect(rejected.ok).toBe(false);
  expect(
    (
      await app.evaluate(
        () => (globalThis as unknown as { setupURLs: string[] }).setupURLs,
      )
    ).length,
  ).toBe(2);
  await page.screenshot({ path: "test-results/google-setup.png" });
});
