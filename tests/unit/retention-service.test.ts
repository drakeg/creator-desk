import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { CredentialVault } from "../../src/main/credentials";
import { YouTube } from "../../src/main/youtube/service";
import { SCOPES } from "../../src/main/youtube/oauth";
import type { Transport } from "../../src/main/youtube/http";

const stores: Store[] = [];
const id = "UC1234567890123456789012";
const videoId = "abcdefghijk";
const query = { channelId: id, videoId, startDate: "2026-10-01", endDate: "2026-10-31" };
const columns = [
  { name: "elapsedVideoTimeRatio" },
  { name: "audienceWatchRatio" },
  { name: "relativeRetentionPerformance" },
];
afterEach(() => {
  for (const store of stores) {
    store.close();
    rmSync(store.root, { recursive: true, force: true });
  }
  stores.length = 0;
});
function setup(transport: Transport) {
  const store = new Store(mkdtempSync(join(tmpdir(), "retention-service-")));
  stores.push(store);
  const workspace = store.create({ name: "One" });
  const vault = new CredentialVault(store.root, {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  });
  vault.set(`youtube-${workspace.id}`, JSON.stringify({
    client: { client_id: "test.apps.googleusercontent.com", client_secret: "fixture" },
    tokens: {
      access_token: "fixture",
      refresh_token: "fixture",
      expiresAt: Date.now() + 3600000,
      scopes: SCOPES,
    },
  }));
  store.db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run(
    `youtube-snapshot-${workspace.id}`,
    JSON.stringify({
      id,
      title: "Owned channel",
      views: 10,
      subscribers: 2,
      videos: 1,
      syncedAt: "2026-11-11T12:00:00.000Z",
    }),
  );
  return { store, vault, youtube: new YouTube(store, vault, async () => {}, transport) };
}
function goodTransport(): Transport {
  return async (raw) => {
    const url = new URL(raw);
    if (url.pathname.endsWith("/videos")) {
      return Response.json({ items: [{ id: videoId, snippet: { channelId: id } }] });
    }
    if (url.pathname.endsWith("/reports")) {
      return Response.json({
        columnHeaders: columns,
        rows: [[0, 1.25, 0.9], [0.5, 0.7, 0.5]],
      });
    }
    throw Error("Unexpected endpoint");
  };
}
it("fetches one owned video and exposes only the cached data", async () => {
  const { youtube } = setup(goodTransport());
  expect(youtube.retention(query)).toBeNull();
  const record = await youtube.syncRetention(query);
  expect(record.points[0].audienceWatchRatio).toBe(1.25);
  expect(youtube.retention(query)).toEqual(record);
  expect(JSON.stringify(record)).not.toContain("fixture");
  expect(() => youtube.retention({ ...query, channelId: "UC" + "b".repeat(22) })).toThrow();
});
it("preserves the previous curve on failed refresh", async () => {
  let fail = false;
  const { youtube } = setup(async (url, init) => {
    if (fail) return Response.json({}, { status: 503 });
    return goodTransport()(url, init);
  });
  const original = await youtube.syncRetention(query);
  fail = true;
  await expect(youtube.syncRetention(query)).rejects.toThrow();
  expect(youtube.retention(query)).toEqual(original);
});
it("cancels the in-flight request before replacing data", async () => {
  let release: (() => void) | undefined;
  let hold = false;
  const { youtube } = setup(async (url, init) => {
    if (hold && url.includes("/reports")) {
      await new Promise<void>((resolve) => { release = resolve; });
    }
    return goodTransport()(url, init);
  });
  const original = await youtube.syncRetention(query);
  hold = true;
  const task = youtube.syncRetention(query);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 0));
  await expect(youtube.syncRetention(query)).rejects.toThrow(/already running/);
  youtube.cancelRetention();
  release!();
  await expect(task).rejects.toThrow(/stopped/);
  expect(youtube.retention(query)).toEqual(original);
});
it("does not publish a response after workspace selection changes", async () => {
  const { store, youtube } = setup(async (url, init) => {
    if (url.includes("/reports")) store.create({ name: "Different channel" });
    return goodTransport()(url, init);
  });
  await expect(youtube.syncRetention(query)).rejects.toThrow(/stopped/);
  store.select({ id: store.state().workspaces[0].id });
  expect(youtube.retention(query)).toBeNull();
});

it("reads previously saved retention offline after disconnect without using Google", async () => {
  let calls = 0;
  const { store, youtube } = setup(async (url, init) => {
    calls++;
    return goodTransport()(url, init);
  });
  const saved = await youtube.syncRetention(query);
  const beforeOffline = calls;
  youtube.disconnect();
  expect(youtube.state().connected).toBe(false);
  expect(youtube.state().snapshot).toBeNull();
  expect(youtube.retention(query)).toEqual(saved);
  expect(calls).toBe(beforeOffline);
  await expect(youtube.syncRetention(query)).rejects.toThrow();
  const second = store.create({ name: "Other workspace" });
  expect(youtube.retention(query)).toBeNull();
  store.select({ id: store.state().workspaces.find((w) => w.id !== second.id)!.id });
  expect(youtube.retention(query)).toEqual(saved);
});

it("does not expose old cached retention through an unverified replacement connection", async () => {
  const { store, vault, youtube } = setup(goodTransport());
  await youtube.syncRetention(query);
  const workspaceId = store.state().selectedWorkspaceId!;
  youtube.disconnect();
  // An in-progress replacement account without a matching snapshot cannot
  // inherit the previous channel's cached results.
  vault.set(`youtube-${workspaceId}`, JSON.stringify({
    client: { client_id: "test.apps.googleusercontent.com", client_secret: "fixture" },
    tokens: {
      access_token: "unverified",
      refresh_token: "new-token",
      expiresAt: Date.now() + 3600000,
      scopes: SCOPES,
    },
  }));
  expect(() => youtube.retention(query)).toThrow(/Sync the connected/);
});
