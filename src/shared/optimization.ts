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
  return { tips, candidateTags };
}
