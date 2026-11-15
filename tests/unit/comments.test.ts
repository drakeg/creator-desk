import { describe, expect, it } from "vitest";
import { inboxSnapshot, parseThreads, threadPage } from "../../src/shared/comments";

const channel = "UC1234567890123456789012";
const other = "UC0000000000000000000000";
function comment(id: string, author: string, updated = "2026-11-15T01:00:00Z") {
  return { id, snippet: {
    authorDisplayName: author, authorChannelId: { value: author === "owner" ? channel : other },
    textOriginal: "Useful video!", publishedAt: "2026-11-15T00:00:00Z", updatedAt: updated,
  } };
}
function thread(id: string, count: number, replies: ReturnType<typeof comment>[] = []) {
  return {
    id, snippet: {
      channelId: channel, videoId: "abcdefghijk",
      topLevelComment: comment(id+"-top", "viewer"), totalReplyCount: count,
    }, replies: { comments: replies },
  };
}
function parse(items: ReturnType<typeof thread>[], prior: ReturnType<typeof parseThreads> | null = null) {
  return parseThreads([threadPage.parse({ items })], channel, prior, true, "2026-11-15T02:00:00Z");
}
describe("channel comments triage", () => {
  it("only claims unanswered when all returned replies are covered", () => {
    const result = parse([
      thread("a", 0),
      thread("b", 1, [comment("reply", "viewer")]),
      thread("c", 3, [comment("partial", "viewer")]),
      thread("d", 3, [comment("own-reply", "owner")]),
    ]);
    expect(result.items.map(i => i.response)).toEqual([
      "unanswered", "unanswered", "unknown", "responded",
    ]);
  });
  it("retains read state and marks changed conversations unread", () => {
    const first = parse([thread("a", 0)]);
    expect(first.items[0]?.unread).toBe(true);
    const reviewed = inboxSnapshot.parse({
      ...first, items: first.items.map(i => ({ ...i, unread: false })),
    });
    expect(parse([thread("a", 0)], reviewed).items[0]?.unread).toBe(false);
    expect(parse([thread("a", 1, [comment("r", "viewer")])], reviewed).items[0]?.unread).toBe(true);
  });
  it("rejects cross-channel history and excludes owner's own top-level comments", () => {
    const first = parse([thread("a", 0)]);
    const fromOther = inboxSnapshot.parse({ ...first, channelId: other,
      items: first.items.map(i => ({ ...i, unread: false })) });
    expect(parse([thread("a", 0)], fromOther).items[0]?.unread).toBe(true);
    const own = thread("owner-top", 0);
    own.snippet.topLevelComment = comment("top", "owner");
    expect(parse([own]).items).toHaveLength(0);
  });
  it("validates bad comment thread data", () => {
    expect(threadPage.safeParse({ items: [{ ...thread("x", 0), snippet: {
      ...thread("x", 0).snippet, totalReplyCount: -1,
    } }] }).success).toBe(false);
  });
});
