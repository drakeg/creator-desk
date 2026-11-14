import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { checkDatabase } from "../../src/main/storage/schema";
import { YouTubeChanges } from "../../src/main/youtube/change-tracker";
import { changeDraft, officialYouTubeSource } from "../../src/shared/youtube-changes";

const stores: Store[] = [];
afterEach(() => {
  for (const store of stores) { store.close(); rmSync(store.root, { recursive: true, force: true }); }
  stores.length = 0;
});
const value = {
  category: "monetization" as const,
  title: "Example official source to review",
  sourceUrl: "https://support.google.com/youtube/answer/72851",
  publishedDate: null,
  effectiveDate: null,
  description: "An example record for testing, not a verified policy change.",
  channelImpact: "Review eligibility details before changing channel plans.",
  requiredAction: "Verify the current official guidance.",
  verification: "unverified" as const,
  status: "verify" as const,
  followUpDate: null,
  notes: "",
};
function setup() {
  const store = new Store(mkdtempSync(join(tmpdir(), "youtube-changes-")));
  stores.push(store);
  return store;
}
describe("official change sources and records", () => {
  it("permits authoritative sites and rejects rumors, lookalikes and unsafe links", () => {
    expect(officialYouTubeSource(value.sourceUrl)).toBe(true);
    expect(officialYouTubeSource("https://blog.youtube/inside-youtube/")).toBe(true);
    expect(officialYouTubeSource("https://www.ftc.gov/business-guidance")).toBe(true);
    for (const url of [
      "http://support.google.com/youtube/answer/72851",
      "https://support.google.com.evil.example/youtube",
      "https://youtube.com.evil.example/claim",
      "https://reddit.com/r/youtube",
      "javascript:alert(1)",
      "https://fake:secret@youtube.com/something",
    ]) {
      expect(officialYouTubeSource(url)).toBe(false);
      expect(changeDraft.safeParse({ ...value, sourceUrl: url }).success).toBe(false);
    }
  });
  it("persists and edits status without inventing effective dates; backup validates", () => {
    const store = setup();
    store.create({ name: "Mad Mallards Adventures" });
    const changes = new YouTubeChanges(store);
    const first = changes.save({ value })[0]!;
    expect(first.publishedDate).toBeNull();
    expect(first.effectiveDate).toBeNull();
    expect(first.status).toBe("verify");
    const revised = changes.save({
      id: first.id, value: { ...value, status: "in_progress", verification: "verified" },
    });
    expect(revised).toHaveLength(1);
    expect(revised[0]?.id).toBe(first.id);
    expect(revised[0]?.status).toBe("in_progress");
    expect(checkDatabase(store.db)).toHaveLength(1);
    store.close();
    store.open();
    expect(new YouTubeChanges(store).list()[0]?.verification).toBe("verified");
  });
  it("isolates records across channel workspaces and rejects wrong-workspace edits", () => {
    const store = setup();
    const firstWorkspace = store.create({ name: "First channel" });
    const changes = new YouTubeChanges(store);
    const one = changes.save({ value })[0]!;
    store.create({ name: "Another channel" });
    expect(changes.list()).toHaveLength(0);
    expect(() => changes.save({ id: one.id, value })).toThrow(/does not belong/);
    expect(() => changes.remove({ id: one.id })).toThrow(/does not belong/);
    store.select({ id: firstWorkspace.id });
    expect(changes.list()).toHaveLength(1);
    expect(changes.remove({ id: one.id })).toEqual([]);
  });
  it("rejects a tampered saved record during backup validation", () => {
    const store = setup();
    store.create({ name: "Channel" });
    const item = new YouTubeChanges(store).save({ value })[0]!;
    store.db.prepare("UPDATE settings SET value=? WHERE key=?").run(
      JSON.stringify({ ...item, sourceUrl: "https://example.com/rumor" }),
      `youtube-change:${item.workspaceId}:${item.id}`,
    );
    expect(() => checkDatabase(store.db)).toThrow();
  });
});
