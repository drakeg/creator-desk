import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  reporter: "list",
  outputDir: "test-results",
  use: { trace: "retain-on-failure" },
});
