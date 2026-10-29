import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
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
