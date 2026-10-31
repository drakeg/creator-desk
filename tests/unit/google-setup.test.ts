import { afterEach, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publisherClient } from "../../scripts/google-client-config.mjs";
import { loadAppClient } from "../../src/main/youtube/app-client";
import { googleSetupURL } from "../../src/main/youtube/setup-links";
import { googleSetupPages } from "../../src/shared/google-setup";
const roots: string[] = [];
afterEach(() => {
  roots.forEach((root) => rmSync(root, { recursive: true, force: true }));
  roots.length = 0;
});
const fixture = {
  client_id: "fixture.apps.googleusercontent.com",
  client_secret: "fixture-desktop",
};
it("opens only named official setup destinations and rejects arbitrary URLs", () => {
  for (const page of Object.keys(googleSetupPages))
    expect(new URL(googleSetupURL({ page })).protocol).toBe("https:");
  expect(googleSetupURL({ page: "clients" })).toBe(
    "https://console.cloud.google.com/auth/clients",
  );
  expect(() => googleSetupURL({ page: "https://evil.example" })).toThrow();
  expect(() =>
    googleSetupURL({ page: "clients", url: "https://evil.example" }),
  ).toThrow();
});
it("accepts only Desktop app configuration and strips endpoint overrides", () => {
  expect(publisherClient()).toBe(null);
  expect(
    publisherClient(
      JSON.stringify({
        installed: {
          ...fixture,
          token_uri: "https://evil.example",
          project_id: "project",
        },
      }),
    ),
  ).toEqual(fixture);
  expect(() => publisherClient(JSON.stringify({ web: fixture }))).toThrow(
    "Desktop app",
  );
  expect(() => publisherClient("{private-sensitive-content")).toThrow(
    "must contain",
  );
});
it("loads optional packaged configuration without exposing secret input in errors", () => {
  const root = mkdtempSync(join(tmpdir(), "google-app-"));
  roots.push(root);
  const path = join(root, "google-client.json");
  expect(loadAppClient(path)).toBe(null);
  writeFileSync(path, JSON.stringify({ installed: fixture }));
  expect(loadAppClient(path)).toEqual(fixture);
  writeFileSync(path, "private-sensitive-content");
  expect(() => loadAppClient(path)).toThrow(
    "built-in Google configuration is invalid",
  );
});
