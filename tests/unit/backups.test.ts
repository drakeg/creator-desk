import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  symlinkSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../../src/main/storage/store";
import { Backups } from "../../src/main/storage/backups";
const roots: string[] = [];
const stores: Store[] = [];
function setup() {
  const root = mkdtempSync(join(tmpdir(), "creator-backups-"));
  roots.push(root);
  const store = new Store(root);
  stores.push(store);
  return {
    root,
    store,
    backups: new Backups(store),
    destination: join(root, "test.creatorbackup"),
  };
}
afterEach(() => {
  stores.forEach((s) => s.close());
  roots.forEach((r) => rmSync(r, { recursive: true, force: true }));
  roots.length = stores.length = 0;
});
describe("backup and restore", () => {
  it("restores every workspace and setting and excludes credential files", async () => {
    const { root, store, backups, destination } = setup();
    const first = store.create({ name: "Channel one" });
    store.create({ name: "Channel two" });
    store.select({ id: first.id });
    store.setAppearance({ mode: "dark" });
    writeFileSync(join(root, "credentials.json"), "PRIVATE-REFRESH-TOKEN");
    await backups.export(destination);
    expect(readFileSync(destination, "utf8")).not.toContain(
      "PRIVATE-REFRESH-TOKEN",
    );
    store.rename({ id: first.id, name: "Changed" });
    store.setAppearance({ mode: "light" });
    const preview = backups.inspect(destination);
    expect(preview.workspaces).toHaveLength(2);
    await backups.restore(preview.previewId);
    expect(store.state().workspaces.find((w) => w.id === first.id)?.name).toBe(
      "Channel one",
    );
    expect(store.state().appearance).toBe("dark");
    expect(readFileSync(join(root, "credentials.json"), "utf8")).toBe(
      "PRIVATE-REFRESH-TOKEN",
    );
    expect(
      readdirSync(join(root, "backups")).some((n) =>
        n.endsWith(".creatorbackup"),
      ),
    ).toBe(true);
    store.close();
    const reopened = new Store(root);
    stores.push(reopened);
    expect(reopened.state().workspaces).toHaveLength(2);
  });
  it("rejects corrupt, future and path-bearing containers without touching live data", async () => {
    const { store, backups, destination } = setup();
    store.create({ name: "Keep me" });
    await backups.export(destination);
    const valid = JSON.parse(readFileSync(destination, "utf8"));
    const before = store.state();
    for (const bad of [
      { ...valid, version: 99 },
      { ...valid, files: { "../../outside": "bad" } },
      { ...valid, database: { ...valid.database, sha256: "0".repeat(64) } },
    ]) {
      writeFileSync(destination, JSON.stringify(bad));
      expect(() => backups.inspect(destination)).toThrow();
      expect(store.state()).toEqual(before);
    }
    writeFileSync(destination, "{truncated");
    expect(() => backups.inspect(destination)).toThrow();
  });
  it("rejects a structurally unsupported SQLite payload even with a correct hash", async () => {
    const { root, store, backups, destination } = setup();
    store.create({ name: "Original" });
    await backups.export(destination);
    const payload = JSON.parse(readFileSync(destination, "utf8"));
    const file = join(root, "unsupported.db");
    writeFileSync(file, Buffer.from(payload.database.content, "base64"));
    const db = new DatabaseSync(file);
    db.exec("CREATE TABLE injected (path TEXT)");
    db.close();
    const bytes = readFileSync(file);
    payload.database = {
      encoding: "base64",
      content: bytes.toString("base64"),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    writeFileSync(destination, JSON.stringify(payload));
    expect(() => backups.inspect(destination)).toThrow();
    expect(store.state().workspaces[0].name).toBe("Original");
  });
  it("rejects expired, cancelled and changed previews", async () => {
    const { store, backups, destination } = setup();
    store.create({ name: "Original" });
    await backups.export(destination);
    const preview = backups.inspect(destination);
    backups.cancel();
    await expect(backups.restore(preview.previewId)).rejects.toThrow();
    const changed = backups.inspect(destination);
    store.create({ name: "Newer" });
    await expect(backups.restore(changed.previewId)).rejects.toThrow(/changed/);
    const expired = backups.inspect(destination);
    await expect(
      backups.restore(expired.previewId, Date.now() + 16 * 60_000),
    ).rejects.toThrow(/expired/);
    expect(store.state().workspaces).toHaveLength(2);
  });
  it("rolls back database activation failure and keeps a recovery backup", async () => {
    const { root, store, destination } = setup();
    const backups = new Backups(store, () => {
      throw new Error("Injected activation failure");
    });
    const w = store.create({ name: "Before export" });
    await backups.export(destination);
    store.rename({ id: w.id, name: "Keep this newer value" });
    const preview = backups.inspect(destination);
    await expect(backups.restore(preview.previewId)).rejects.toThrow();
    expect(store.state().workspaces[0].name).toBe("Keep this newer value");
    expect(readdirSync(join(root, "backups"))).not.toHaveLength(0);
  });
});

it("rejects an oversized backup before reading its contents", async () => {
  const { store, backups, destination } = setup();
  store.create({ name: "Preserved" });
  await backups.export(destination);
  truncateSync(destination, 32 * 1024 * 1024 + 1);
  expect(() => backups.inspect(destination)).toThrow();
  expect(store.state().workspaces[0].name).toBe("Preserved");
});
it("rejects a symlink instead of following it to another file", async () => {
  const { root, store, backups, destination } = setup();
  store.create({ name: "Preserved" });
  await backups.export(destination);
  const alias = join(root, "alias.creatorbackup");
  symlinkSync(destination, alias);
  expect(() => backups.inspect(alias)).toThrow();
  expect(store.state().workspaces[0].name).toBe("Preserved");
});
