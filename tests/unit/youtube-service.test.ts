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
  complete({ access_token: "late", refresh_token: "late", expiresAt: 0 });
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
