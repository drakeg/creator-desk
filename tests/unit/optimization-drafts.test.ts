import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { savedOptimizationDraft, saveOptimizationDraftRequest } from "../../src/shared/optimization";

const root = mkdtempSync(join(tmpdir(), "creator-opt-draft-"));
const stores: Store[] = [];
afterEach(() => {
  for (const store of stores) store.close();
  stores.length = 0;
});
const original = {
  videoId: "abcdefghijk", channelId: "UC1234567890123456789012",
  title: "Original title", description: "Original description",
  tags: ["solar"], fetchedAt: "2026-11-20T00:00:00Z",
};
const saved = { original, draft: {
  title: "New title", description: "Draft description", tags: "solar, RV",
} };
function open() {
  const store = new Store(root);
  stores.push(store);
  return store;
}
describe("workspace-isolated optimization draft persistence", () => {
  it("validates channel and video identity", () => {
    expect(saveOptimizationDraftRequest.safeParse({
      videoId: original.videoId, channelId: original.channelId, saved,
    }).success).toBe(true);
    expect(saveOptimizationDraftRequest.safeParse({
      videoId: "zzzzzzzzzzz", channelId: original.channelId, saved,
    }).success).toBe(false);
    expect(savedOptimizationDraft.safeParse(saved).success).toBe(true);
  });
  it("persists across reopening while isolating workspaces and channels", () => {
    const store = open();
    const first = store.create({ name: "First channel" });
    store.saveOptimizationDraft(original.videoId, original.channelId, saved);
    expect(store.getOptimizationDraft(original.videoId, original.channelId)).toEqual(saved);
    expect(store.getOptimizationDraft(original.videoId, "UCaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    const second = store.create({ name: "Other channel" });
    expect(store.getOptimizationDraft(original.videoId, original.channelId)).toBeNull();
    store.select({ id: first.id });
    store.close();
    const reopened = open();
    expect(reopened.getOptimizationDraft(original.videoId, original.channelId)).toEqual(saved);
    reopened.select({ id: second.id });
    expect(reopened.getOptimizationDraft(original.videoId, original.channelId)).toBeNull();
    reopened.select({ id: first.id });
    reopened.saveOptimizationDraft(original.videoId, original.channelId, null);
    expect(reopened.getOptimizationDraft(original.videoId, original.channelId)).toBeNull();
  });
});
