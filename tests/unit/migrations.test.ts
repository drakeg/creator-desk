import { afterEach, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../src/main/storage/store";
const roots: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  stores.forEach((s) => s.close());
  roots.forEach((p) => rmSync(p, { recursive: true, force: true }));
  stores.length = roots.length = 0;
});
function old() {
  const root = mkdtempSync(join(tmpdir(), "migration-test-"));
  roots.push(root);
  const db = new DatabaseSync(join(root, "creator.db"));
  db.exec(
    "CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT; CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; PRAGMA user_version=1;",
  );
  db.prepare("INSERT INTO workspaces VALUES(?,?,?,?)").run(
    "0ac8f31d-b119-46e4-9785-31919f59862c",
    "Original",
    "2026-10-28T00:00:00.000Z",
    "2026-10-28T00:00:00.000Z",
  );
  db.close();
  return root;
}
it("upgrades schema 1 without losing workspaces and saves a compatible backup first", () => {
  const root = old();
  const store = new Store(root);
  stores.push(store);
  expect(store.state().workspaces[0].name).toBe("Original");
  expect(store.db.prepare("PRAGMA user_version").get()?.user_version).toBe(2);
  const file = readdirSync(join(root, "backups"))[0];
  const backup = JSON.parse(readFileSync(join(root, "backups", file), "utf8"));
  expect(backup.workspaces[0].name).toBe("Original");
  expect(
    Buffer.from(backup.database.content, "base64").subarray(0, 16).toString(),
  ).toBe("SQLite format 3\0");
});
it("rolls back a failed migration and preserves schema 1 plus the backup", () => {
  const root = old();
  expect(
    () =>
      new Store(root, () => {
        throw new Error("Injected failure");
      }),
  ).toThrow();
  const db = new DatabaseSync(join(root, "creator.db"));
  expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(1);
  expect(
    db.prepare("SELECT name FROM sqlite_schema WHERE name='reports'").get(),
  ).toBeUndefined();
  db.close();
  expect(readdirSync(join(root, "backups"))).toHaveLength(1);
  const recovered = new Store(root);
  stores.push(recovered);
  expect(recovered.state().workspaces[0].name).toBe("Original");
});

it("restores a schema-1 backup into the new app and upgrades it safely", async () => {
  const root = old();
  const store = new Store(root);
  stores.push(store);
  const file = join(root, "backups", readdirSync(join(root, "backups"))[0]);
  store.create({ name: "Newer workspace" });
  const { Backups } = await import("../../src/main/storage/backups");
  const backups = new Backups(store);
  const preview = backups.inspect(file);
  await backups.restore(preview.previewId);
  expect(store.state().workspaces).toHaveLength(1);
  expect(store.state().workspaces[0].name).toBe("Original");
  expect(store.db.prepare("PRAGMA user_version").get()?.user_version).toBe(2);
  expect(store.db.prepare("SELECT COUNT(*) AS n FROM reports").get()?.n).toBe(
    0,
  );
});
