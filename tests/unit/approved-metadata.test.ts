import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { CredentialVault } from "../../src/main/credentials";
import { History } from "../../src/main/youtube/history";
import { YouTube } from "../../src/main/youtube/service";
import { EDIT_SCOPE, SCOPES } from "../../src/main/youtube/oauth";
import { approvedMetadataUpdate, optimizationResult } from "../../src/shared/optimization";
import type { Transport } from "../../src/main/youtube/http";

const channel = "UC1234567890123456789012";
const videoId = "abcdefghijk";
const client = { client_id: "test.apps.googleusercontent.com", client_secret: "fixture" };
const initial = { channelId: channel, title: "RV Solar Battery Upgrade",
  description: "Original source content and disclosures.",
  tags: ["RV solar"], categoryId: "22", defaultLanguage: "en" };
const original = optimizationResult.parse({
  videoId, channelId: channel, title: initial.title, description: initial.description,
  tags: initial.tags, fetchedAt: "2026-11-15T00:00:00.000Z",
});
const proposed = {
  title: "RV Solar Battery Upgrade: What We Learned",
  description: initial.description,
  tags: ["RV solar", "solar upgrades"],
};
const approval = { original, proposed, approved: true as const };

const stores: Store[] = [];
afterEach(() => {
  for (const store of stores) {
    store.close();
    rmSync(store.root, { recursive: true, force: true });
  }
  stores.length = 0;
});
function setup(transport: Transport) {
  const store = new Store(mkdtempSync(join(tmpdir(), "approved-metadata-")));
  stores.push(store);
  const workspace = store.create({ name: "Own YouTube channel" });
  const vault = new CredentialVault(store.root, {
    isEncryptionAvailable: () => true,
    encryptString: text => Buffer.from(text),
    decryptString: bytes => bytes.toString(),
  });
  const credentials = {
    client,
    tokens: { access_token: "read", refresh_token: "read",
      expiresAt: Date.now() + 3600000, scopes: SCOPES },
  };
  vault.set(`youtube-${workspace.id}`, JSON.stringify(credentials));
  vault.set(`youtube-edit-${workspace.id}`, JSON.stringify({
    client, channelId: channel,
    tokens: { ...credentials.tokens, access_token: "editor",
      scopes: [...SCOPES, EDIT_SCOPE] },
  }));
  store.db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run(
    `youtube-snapshot-${workspace.id}`,
    JSON.stringify({
      id: channel, title: "My channel",
      views: 12, subscribers: 4, videos: 1,
      syncedAt: "2026-11-15T00:00:00.000Z",
    }),
  );
  new History(store).save(workspace.id, channel, "My channel",
    "2026-01-01", "2026-11-15", null, {
      kind: "videos", metrics: ["views"], warnings: [],
      rows: [{
        id: videoId, title: initial.title, date: null, published: "2026-11-01",
        views: 99, watchHours: null, subscribers: null, impressions: null,
      }],
    });
  return { youtube: new YouTube(store, vault, async () => {}, transport),
    store, vault, workspace };
}
describe("explicit YouTube metadata updates", () => {
  it("requires explicit approval, supported limits and an actual change", () => {
    expect(approvedMetadataUpdate.safeParse(approval).success).toBe(true);
    expect(approvedMetadataUpdate.safeParse({ ...approval, approved: false }).success).toBe(false);
    expect(approvedMetadataUpdate.safeParse({ ...approval, proposed: {
      title: original.title, description: original.description, tags: original.tags,
    } }).success).toBe(false);
    expect(approvedMetadataUpdate.safeParse({ ...approval, proposed: {
      ...proposed, description: "é".repeat(3000),
    } }).success).toBe(false);
    expect(approvedMetadataUpdate.safeParse({ ...approval, proposed: {
      ...proposed, title: "<script>",
    } }).success).toBe(false);
  });

  it("updates only the approved video's snippet, verifies readback and logs the result", async () => {
    let current = { ...initial, tags: [...initial.tags] };
    const sent: unknown[] = [];
    const transport: Transport = async (_url, options) => {
      if (url.includes("/videos") && options.method === "PUT") {
        const body = JSON.parse(String(options.body));
        sent.push(body);
        expect(options.headers).toMatchObject({ Authorization: "Bearer editor" });
        expect(body).toEqual({ id: videoId, snippet: {
          title: proposed.title, description: proposed.description,
          tags: proposed.tags, categoryId: "22", defaultLanguage: "en",
        } });
        current = { ...current, ...body.snippet };
        return Response.json({ id: videoId });
      }
      if (url.includes("/videos")) return Response.json({
        items: [{ id: videoId, snippet: current }],
      });
      throw Error("Unexpected mock API");
    };
    const { youtube, store, workspace } = setup(transport);
    const updated = await youtube.applyApprovedMetadata(approval);
    expect(updated.title).toBe(proposed.title);
    expect(updated.tags).toEqual(proposed.tags);
    expect(sent).toHaveLength(1);
    const history = store.db.prepare(
      "SELECT key,value FROM settings WHERE key LIKE ?",
    ).all(`youtube-metadata-audit:${workspace.id}:%`) as { key: string; value: string }[];
    expect(history).toHaveLength(3);
    const meta = history.find(row => row.key.endsWith(":meta"));
    const before = history.find(row => row.key.endsWith(":before"));
    const after = history.find(row => row.key.endsWith(":after"));
    expect(JSON.parse(meta!.value)).toMatchObject({
      videoId, channelId: channel, result: "verified",
    });
    expect(JSON.parse(before!.value)).toMatchObject({ title: original.title });
    expect(JSON.parse(after!.value)).toEqual(proposed);
    const { checkDatabase } = await import("../../src/main/storage/schema");
    expect(() => checkDatabase(store.db)).not.toThrow();
  });

  it("rejects stale or wrong-channel requests before any YouTube PUT", async () => {
    let writes = 0;
    const transport: Transport = async (url, options) => {
      if (options.method === "PUT") { writes++; return Response.json({ id: videoId }); }
      return Response.json({ items: [{
        id: videoId, snippet: { ...initial, title: "Someone changed this title" },
      }] });
    };
    const { youtube } = setup(transport);
    await expect(youtube.applyApprovedMetadata(approval)).rejects.toThrow(/changed/);
    await expect(youtube.applyApprovedMetadata({
      ...approval, original: { ...original, channelId: "UC0000000000000000000000" },
    })).rejects.toThrow(/connected channel/);
    expect(writes).toBe(0);
  });

  it("does not retry when a YouTube PUT fails ambiguously", async () => {
    let writes = 0;
    const { youtube } = setup(async (_url, options) => {
      if (options.method === "PUT") {
        writes++;
        throw Error("Connection failed after server accepted request");
      }
      return Response.json({ items: [{ id: videoId, snippet: initial }] });
    });
    await expect(youtube.applyApprovedMetadata(approval)).rejects.toThrow(/will not automatically retry/);
    expect(writes).toBe(1);
  });
});
