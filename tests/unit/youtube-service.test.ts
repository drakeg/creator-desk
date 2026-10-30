import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { CredentialVault } from "../../src/main/credentials";
import { YouTube } from "../../src/main/youtube/service";
import { type Transport } from "../../src/main/youtube/http";
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores) {
    s.close();
    rmSync(s.root, { recursive: true, force: true });
  }
  stores.length = 0;
});
const client = {
  client_id: "test.apps.googleusercontent.com",
  client_secret: "fixture",
};
const channel = {
  id: "UC1234567890123456789012",
  snippet: { title: "Test channel" },
  statistics: { viewCount: "123", subscriberCount: "45", videoCount: "6" },
};
function setup(transport: Transport) {
  const store = new Store(mkdtempSync(join(tmpdir(), "youtube-")));
  stores.push(store);
  store.create({ name: "First" });
  const vault = new CredentialVault(store.root, {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(s),
    decryptString: (b) => b.toString(),
  });
  const youtube = new YouTube(
    store,
    vault,
    async () => {},
    transport,
    async () => ({
      access_token: "access",
      refresh_token: "refresh",
      expiresAt: 0,
      scopes: [],
    }),
  );
  youtube.configure({ installed: client });
  return { store, vault, youtube };
}
async function connect(youtube: YouTube) {
  youtube.connect();
  await new Promise((r) => setTimeout(r, 0));
  expect(youtube.state().connected).toBe(true);
}
it("refreshes access, saves per-workspace snapshots and keeps cached data offline", async () => {
  let offline = false;
  const { store, youtube } = setup(async (url, init) => {
    if (offline) throw new Error("offline");
    if (url.includes("/token"))
      return Response.json({
        access_token: "fresh",
        expires_in: 3600,
        token_type: "Bearer",
      });
    expect(init.headers).toEqual({ Authorization: "Bearer fresh" });
    return Response.json({ items: [channel] });
  });
  await connect(youtube);
  await youtube.sync();
  expect(youtube.state().snapshot?.views).toBe(123);
  offline = true;
  await expect(youtube.sync()).rejects.toThrow("preserved");
  expect(youtube.state().snapshot?.views).toBe(123);
  const first = store.state().selectedWorkspaceId!;
  store.create({ name: "Second" });
  expect(youtube.state().connected).toBe(false);
  expect(youtube.state().snapshot).toBe(null);
  store.select({ id: first });
  expect(youtube.state().snapshot?.title).toBe("Test channel");
  youtube.disconnect();
  expect(youtube.state().snapshot).toBe(null);
  expect(youtube.state().connected).toBe(false);
});
it("preserves hidden metrics and rejects changed channel identities", async () => {
  let changed = false;
  const { youtube } = setup(async (url) =>
    url.includes("/token")
      ? Response.json({
          access_token: "fresh",
          expires_in: 3600,
          token_type: "Bearer",
        })
      : Response.json({
          items: [
            {
              ...channel,
              id: changed ? "UCabcdefghijklmnopqrstuv" : channel.id,
              statistics: {
                ...channel.statistics,
                hiddenSubscriberCount: true,
              },
            },
          ],
        }),
  );
  await connect(youtube);
  await youtube.sync();
  expect(youtube.state().snapshot?.subscribers).toBe(null);
  changed = true;
  await expect(youtube.sync()).rejects.toThrow("channel changed");
  expect(youtube.state().snapshot?.id).toBe(channel.id);
});
it("blocks client replacement while connected and does not expose credentials in state", async () => {
  const { youtube } = setup(async () => Response.json({}));
  await connect(youtube);
  expect(() => youtube.configure({ installed: client })).toThrow("Disconnect");
  expect(JSON.stringify(youtube.state())).not.toMatch(
    /access_token|refresh_token|client_secret/,
  );
});

it("does not save tokens from a cancelled authorization that completes late", async () => {
  const { store, vault } = setup(async () => Response.json({}));
  let complete!: (value: {
    access_token: string;
    refresh_token: string;
    expiresAt: number;
    scopes: string[];
  }) => void;
  const youtube = new YouTube(
    store,
    vault,
    async () => {},
    fetch,
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  youtube.connect();
  expect(youtube.state().pending).toBe(true);
  youtube.cancelAll();
  complete({
    access_token: "late",
    refresh_token: "late",
    expiresAt: 0,
    scopes: [],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(youtube.state().connected).toBe(false);
});

it("validates channel snapshots during backup inspection and preserves them through reopening", async () => {
  const { store, youtube } = setup(async (url) =>
    url.includes("/token")
      ? Response.json({
          access_token: "fresh",
          expires_in: 3600,
          token_type: "Bearer",
        })
      : Response.json({ items: [channel] }),
  );
  await connect(youtube);
  await youtube.sync();
  const { checkDatabase } = await import("../../src/main/storage/schema");
  expect(() => checkDatabase(store.db)).not.toThrow();
  store.close();
  store.open();
  expect(youtube.state().snapshot?.views).toBe(123);
  const cache = `youtube-snapshot-${store.state().selectedWorkspaceId}`;
  store.db
    .prepare("UPDATE settings SET value=? WHERE key=?")
    .run(JSON.stringify({ ...youtube.state().snapshot, views: -1 }), cache);
  expect(() => checkDatabase(store.db)).toThrow();
});

it("requires renewed Analytics consent for legacy connections without destroying tokens", async () => {
  const { youtube } = setup(async () =>
    Response.json({
      access_token: "fresh",
      expires_in: 3600,
      token_type: "Bearer",
    }),
  );
  await connect(youtube);
  await expect(
    youtube.syncDaily({ startDate: "2026-01-01", endDate: "2026-01-02" }),
  ).rejects.toThrow("additional read-only permission");
  expect(youtube.state().connected).toBe(true);
});

it("saves and deduplicates API daily reports, includes them in backups and preserves reports on failure", async () => {
  const { SCOPES } = await import("../../src/main/youtube/oauth");
  let fail = false;
  const { store, vault, youtube } = setup(async (url) => {
    if (url.includes("/token"))
      return Response.json({
        access_token: "fresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: SCOPES.join(" "),
      });
    if (url.includes("youtubeanalytics")) {
      if (fail) return Response.json({ error: "denied" }, { status: 403 });
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
        rows: [["2026-01-01", 100, 120, 5, 2]],
      });
    }
    return Response.json({ items: [channel] });
  });
  await connect(youtube);
  const result = await youtube.syncDaily({
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  });
  const { Reports } = await import("../../src/main/imports/reports");
  const report = new Reports(store).dashboard({ reportId: result.reportId });
  expect(report.selected).toMatchObject({
    source: "youtube-daily",
    channelId: channel.id,
    periodStart: "2026-01-01",
    periodEnd: "2026-01-01",
  });
  expect(report.totals).toMatchObject({
    views: 100,
    watchHours: 2,
    subscribers: 3,
  });
  expect(
    (
      await youtube.syncDaily({
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      })
    ).duplicate,
  ).toBe(true);
  const { checkDatabase } = await import("../../src/main/storage/schema");
  expect(() => checkDatabase(store.db)).not.toThrow();
  fail = true;
  await expect(
    youtube.syncDaily({ startDate: "2026-01-01", endDate: "2026-01-02" }),
  ).rejects.toThrow("Google denied");
  expect(new Reports(store).dashboard({}).reports).toHaveLength(1);
  expect(vault.has(`youtube-${store.state().selectedWorkspaceId}`)).toBe(true);
});
