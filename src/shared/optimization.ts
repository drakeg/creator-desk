import { z } from "zod";

export const optimizationRequest = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
}).strict();
export const optimizationResult = z.object({
  videoId: optimizationRequest.shape.videoId,
  channelId: z.string().regex(/^UC[a-zA-Z0-9_-]{22}$/),
  title: z.string().min(1).max(100),
  description: z.string().max(5000),
  tags: z.array(z.string().min(1).max(500)).max(500),
  fetchedAt: z.iso.datetime(),
}).strict();
export type OptimizationResult = z.infer<typeof optimizationResult>;

export interface OptimizationTip {
  field: "title" | "description" | "tags";
  label: string;
  reason: string;
}
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
const stop = new Set(["the", "and", "for", "with", "from", "that", "this",
  "your", "you", "are", "was", "our", "into", "about", "how", "what", "why"]);
/** Deterministic, explainable quality checks; not a proprietary reach score. */
export function optimizationAdvice(data: OptimizationResult): {
  tips: OptimizationTip[];
  candidateTags: string[];
  suggestedDescriptionOpening: string | null;
} {
  const tips: OptimizationTip[] = [];
  const title = normalize(data.title);
  if (title.length > 65) tips.push({
    field: "title", label: "Put the main topic early",
    reason: "This title is over 65 characters. Consider moving the clearest topic or benefit toward the beginning; this is a readability suggestion, not a ranking guarantee.",
  });
  if (title.length < 25) tips.push({
    field: "title", label: "Consider adding specific context",
    reason: "This title is short. If your video supports it, add the distinguishing subject, location or outcome instead of generic wording.",
  });
  if (!data.description.trim()) tips.push({
    field: "description", label: "Add a factual video summary",
    reason: "The video description is empty. Add two or three accurate sentences describing what viewers will actually see, followed by any relevant links and disclosures.",
  });
  else if (data.description.trim().length < 100) tips.push({
    field: "description", label: "Add useful context to the description",
    reason: "The description has fewer than 100 characters. Consider a factual summary and relevant chapter markers or links only where accurate.",
  });
  const opening = data.description.trim().slice(0, 240);
  const firstLine = data.description.trim().split(/\r?\n/)[0] ?? "";
  const hasLinkFirst = /https?:\/\//i.test(firstLine) &&
    (/https?:\/\//i.exec(firstLine)?.index ?? 1000) < 100;
  if (hasLinkFirst) tips.push({
    field: "description", label: "Consider leading with the video's story",
    reason: "Your description begins with a web link. Consider starting with one accurate sentence about the video, then keep your existing links and affiliate/sponsor disclosures intact. Do not automatically remove or rearrange required disclosures.",
  });
  const important = title.match(/[\p{L}\p{N}]+/gu)?.filter(word =>
    word.length >= 4 && !stop.has(word.toLocaleLowerCase())) ?? [];
  if (opening.length >= 100 && important.length >= 2) {
    const present = important.filter(word =>
      opening.toLocaleLowerCase().includes(word.toLocaleLowerCase()));
    if (present.length === 0) tips.push({
      field: "description", label: "Connect the opening to your video title",
      reason: `The opening 240 characters don't mention the title's main subject words (${important.slice(0, 3).join(", ")}). Consider a factual opening that explains the connection; don't add topics the video doesn't cover.`,
    });
  }
  const chapterLines = data.description.split(/\r?\n/).filter(line =>
    /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\s+\S/.test(line));
  if (chapterLines.length > 0 && !chapterLines.some(line => /^\s*0{1,2}:00(?:\s|$)/.test(line))) {
    tips.push({
      field: "description", label: "Check chapter timestamps",
      reason: "Your description contains timestamp-style chapter lines but none starts at 0:00. If these are YouTube chapters, verify that the first chapter starts at 0:00, that timestamps are ascending, and that each chapter matches the video. Do not invent timestamps.",
    });
  }
  const tags = new Set(data.tags.map(s => normalize(s).toLocaleLowerCase()));
  if (data.tags.length !== tags.size) tips.push({
    field: "tags", label: "Remove duplicate tags",
    reason: "At least two tags differ only by case or whitespace. Review duplicates before deciding whether to update metadata.",
  });
  const words = title.match(/[\p{L}\p{N}]+/gu) ?? [];
  const candidateTags: string[] = [];
  for (let i = 0; i < words.length - 1 && candidateTags.length < 5; i++) {
    const phrase = words.slice(i, i + 2).join(" ");
    if (words[i]!.length < 3 || words[i + 1]!.length < 3 ||
      stop.has(words[i]!.toLocaleLowerCase()) ||
      stop.has(words[i + 1]!.toLocaleLowerCase())) continue;
    if (!tags.has(phrase.toLocaleLowerCase()) &&
      !candidateTags.some(t => t.toLocaleLowerCase() === phrase.toLocaleLowerCase())) {
      candidateTags.push(phrase);
    }
  }
  if (candidateTags.length) tips.push({
    field: "tags", label: "Review topic phrases from your title",
    reason: "These candidate tags are taken directly from your existing title, not search-volume research. Use only phrases that accurately describe the video; YouTube states tags generally play a minimal role in discovery.",
  });
  if (!tips.length) tips.push({
    field: "title", label: "No basic metadata gaps detected",
    reason: "The automated checks found no simple omissions. This is not proof that the title, description or tags are optimized; review them against the actual video and audience.",
  });
  // This starter uses only text the creator already supplied. It is never
  // sent to YouTube until the creator explicitly reviews and approves a draft.
  const suggestedDescriptionOpening = !data.description.trim() && title
    ? `In this video: ${title}.\n\n[Add a truthful summary of what you show, then links and applicable disclosures.]`
    : null;
  return { tips, candidateTags, suggestedDescriptionOpening };
}

/** Simple local metadata triage, not a video performance score or ranking. */
export function needsMetadataReview(data: OptimizationResult): boolean {
  return optimizationAdvice(data).tips.some(tip =>
    tip.label !== "No basic metadata gaps detected" &&
    tip.label !== "Review topic phrases from your title");
}

export const optimizationField = z.enum(["title", "description", "tags"]);
export type OptimizationField = z.infer<typeof optimizationField>;

/** Produce the exact requested metadata. Unchecked fields cannot change. */
export function selectedMetadata(
  original: OptimizationResult,
  draft: { title: string; description: string; tags: string[] },
  approvedFields: readonly OptimizationField[],
) {
  return {
    title: approvedFields.includes("title") ? draft.title.trim() : original.title,
    description: approvedFields.includes("description") ? draft.description : original.description,
    tags: approvedFields.includes("tags") ? draft.tags : original.tags,
  };
}
/** Exact-diff, per-video approval. These are draft values, not automatic suggestions. */
export const approvedMetadataUpdate = z.object({
  original: optimizationResult,
  proposed: z.object({
    title: z.string().trim().min(1).max(100).refine(v => !/[<>]/.test(v)),
    description: z.string().max(5000).refine(v =>
      !/[<>]/.test(v) && BufferByteLength(v) <= 5000 &&
      !v.includes("[Add a truthful summary of what you show"),
      "YouTube descriptions must be at most 5,000 UTF-8 bytes and cannot contain angle brackets.",
    ),
    tags: z.array(z.string().trim().min(1).max(500)).max(100),
  }).strict().refine(v => {
    const length = v.tags.map(t => t.includes(" ") ? t.length + 2 : t.length)
      .reduce((total, n) => total + n + 1, 0);
    return length <= 500 && v.tags.every(t => !/[<>]/.test(t));
  }, "YouTube tag length exceeds 500 characters or contains unsupported characters."),
  approvedFields: z.array(optimizationField).min(1).max(3)
    .refine(fields => new Set(fields).size === fields.length, "Duplicate field approval."),
  approved: z.literal(true),
}).strict().superRefine((v, ctx) => {
  const keys = ["title", "description", "tags"] as const;
  let changed = false;
  for (const key of keys) {
    const difference = key === "tags" ?
      JSON.stringify(v.proposed.tags) !== JSON.stringify(v.original.tags) :
      v.proposed[key] !== v.original[key];
    if (!v.approvedFields.includes(key) && difference) ctx.addIssue({
      code: "custom", path: ["proposed", key],
      message: `Unapproved ${key} must match the current metadata exactly.`,
    });
    if (v.approvedFields.includes(key) && difference) changed = true;
  }
  if (!changed) ctx.addIssue({
    code: "custom", path: ["approvedFields"],
    message: "Select at least one actual metadata change to apply.",
  });
});
function BufferByteLength(text: string) {
  return new TextEncoder().encode(text).length;
}
export type ApprovedMetadataUpdate = z.infer<typeof approvedMetadataUpdate>;
