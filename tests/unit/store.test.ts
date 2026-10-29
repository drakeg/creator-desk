import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../../src/main/storage/store";
const roots: string[] = [];
const stores: Store[] = [];
function make() {
  const root = mkdtempSync(join(tmpdir(), "creator-store-"));
  roots.push(root);
  const store = new Store(root);
  stores.push(store);
  return { root, store };
}
afterEach(() => {
  stores.forEach((s) => s.close());
  roots.forEach((r) => rmSync(r, { recursive: true, force: true }));
  stores.length = roots.length = 0;
});
describe("workspace persistence", () => {
  it("starts empty and persists Unicode names, selection and appearance through restart", () => {
    const { root, store } = make();
    expect(store.state().workspaces).toEqual([]);
    const first = store.create({ name: "  Montréal / RV 🎥  " });
    store.create({ name: "Second channel" });
    store.select({ id: first.id });
    store.setAppearance({ mode: "dark" });
    store.rename({ id: first.id, name: "Mad Mallards" });
    store.close();
    const reopened = new Store(root);
    stores.push(reopened);
    expect(reopened.state()).toMatchObject({
      selectedWorkspaceId: first.id,
      appearance: "dark",
    });
    expect(
      reopened.state().workspaces.find((w) => w.id === first.id)?.name,
    ).toBe("Mad Mallards");
    expect(reopened.state().workspaces).toHaveLength(2);
  });
  it("rejects invalid names and unknown selections without changing data", () => {
    const { store } = make();
    const before = store.state();
    expect(() => store.create({ name: "  " })).toThrow();
    expect(() => store.create({ name: "x".repeat(81) })).toThrow();
    expect(() => store.create({ name: "a\u0000b" })).toThrow();
    expect(() =>
      store.select({ id: "54a74db4-fc63-49dc-9bee-4d4de24ff3c5" }),
    ).toThrow();
    expect(store.state()).toEqual(before);
  });
  it("rolls back a failed transaction instead of exposing a partial workspace", () => {
    const { store } = make();
    expect(() =>
      store.transaction(() => {
        store.create({ name: "Transient" });
        throw new Error("Disk failure");
      }),
    ).toThrow();
    expect(store.state().workspaces).toEqual([]);
    expect(store.state().selectedWorkspaceId).toBeNull();
  });
  it("refuses a future database version without downgrading it", () => {
    const { root, store } = make();
    store.close();
    const db = new DatabaseSync(join(root, "creator.db"));
    db.exec("PRAGMA user_version=99");
    db.close();
    expect(() => new Store(root)).toThrow(/newer/);
    const check = new DatabaseSync(join(root, "creator.db"));
    expect(check.prepare("PRAGMA user_version").get()?.user_version).toBe(99);
    check.close();
  });
});

it("reports a refused database write without pretending the workspace was saved", () => {
  const { store } = make();
  store.db.exec("PRAGMA query_only=ON");
  expect(() => store.create({ name: "Cannot save" })).toThrow();
  store.db.exec("PRAGMA query_only=OFF");
  expect(store.state().workspaces).toEqual([]);
  expect(store.state().selectedWorkspaceId).toBeNull();
});
