import { z } from "zod";

const channelId = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const timestamp = z.iso.datetime({ offset: true });
const commentId = z.string().min(1).max(200);
export const commentSnippet = z.object({
  authorDisplayName: z.string().max(300),
  authorChannelId: z.object({ value: channelId }).optional(),
  textDisplay: z.string().max(10000).optional(),
  textOriginal: z.string().max(10000).optional(),
  publishedAt: timestamp,
  updatedAt: timestamp,
}).passthrough();
const comment = z.object({ id: commentId, snippet: commentSnippet }).passthrough();
export const threadPage = z.object({
  items: z.array(z.object({
    id: commentId,
    snippet: z.object({
      channelId,
      videoId: videoId.optional(),
      topLevelComment: comment,
      totalReplyCount: z.number().int().nonnegative(),
    }),
    replies: z.object({ comments: z.array(comment).max(100) }).optional(),
  }).passthrough()).max(50),
  nextPageToken: z.string().min(1).max(1000).optional(),
}).passthrough();

export const inboxEntry = z.object({
  id: commentId,
  videoId: videoId.nullable(),
  commentId,
  author: z.string().max(300),
  text: z.string().max(3000),
  publishedAt: timestamp,
  updatedAt: timestamp,
  response: z.enum(["responded", "unanswered", "unknown"]),
  replyCount: z.number().int().nonnegative(),
  unread: z.boolean(),
}).strict();
export const inboxSnapshot = z.object({
  channelId,
  fetchedAt: timestamp,
  complete: z.boolean(),
  items: z.array(inboxEntry).max(100),
}).strict();
export type InboxSnapshot = z.infer<typeof inboxSnapshot>;
export const readCommentInput = z.object({ id: commentId }).strict();

export function parseThreads(
  pages: z.infer<typeof threadPage>[],
  ownChannelId: string,
  previous: InboxSnapshot | null,
  complete: boolean,
  fetchedAt: string,
): InboxSnapshot {
  const prior = new Map(previous?.channelId === ownChannelId
    ? previous.items.map(i => [i.id, i]) : []);
  const seen = new Set<string>();
  const items: z.infer<typeof inboxEntry>[] = [];
  for (const page of pages) for (const thread of page.items) {
    if (thread.snippet.channelId !== ownChannelId) continue;
    const top = thread.snippet.topLevelComment;
    if (seen.has(thread.id) || top.snippet.authorChannelId?.value === ownChannelId) continue;
    seen.add(thread.id);
    const replies = thread.replies?.comments ?? [];
    const ownerReplied = replies.some(c => c.snippet.authorChannelId?.value === ownChannelId);
    const response = ownerReplied ? "responded" :
      thread.snippet.totalReplyCount === 0 ? "unanswered" :
      replies.length >= thread.snippet.totalReplyCount ? "unanswered" : "unknown";
    const previousItem = prior.get(thread.id);
    // A changed top-level comment or newly recorded reply deserves review again.
    const updatedAt = [top.snippet.updatedAt, ...replies.map(r => r.snippet.updatedAt)]
      .sort().at(-1) ?? top.snippet.updatedAt;
    items.push(inboxEntry.parse({
      id: thread.id, commentId: top.id, videoId: thread.snippet.videoId ?? null,
      author: top.snippet.authorDisplayName,
      text: (top.snippet.textOriginal ?? top.snippet.textDisplay ?? "").slice(0, 3000),
      publishedAt: top.snippet.publishedAt, updatedAt,
      response, replyCount: thread.snippet.totalReplyCount,
      unread: !previousItem || previousItem.unread ||
        previousItem.updatedAt !== updatedAt ||
        previousItem.replyCount !== thread.snippet.totalReplyCount,
    }));
  }
  return inboxSnapshot.parse({ channelId: ownChannelId, fetchedAt, complete, items });
}
