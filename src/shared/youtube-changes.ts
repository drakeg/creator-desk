import { z } from "zod";

/** We only admit first-party policy announcements and public regulators.
 * A user must verify the exact linked page; a trusted hostname alone does
 * not establish that the stated change is accurate or effective.
 */
const officialHosts = new Set([
  "youtube.com", "www.youtube.com", "blog.youtube",
  "support.google.com", "developers.google.com",
  "policies.google.com", "adsense.google.com",
  "creatoracademy.youtube.com", "www.ftc.gov", "ftc.gov",
  "www.asa.org.uk", "asa.org.uk",
]);
export function officialYouTubeSource(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && officialHosts.has(url.hostname) &&
      !url.username && !url.password && url.href.length <= 2000;
  } catch {
    return false;
  }
}
const day = z.iso.date();
export const changeCategory = z.enum([
  "monetization", "shorts", "long_form", "sponsorship",
  "affiliate_disclosure", "policy",
]);
export const changeStatus = z.enum(["new", "verify", "in_progress", "completed", "dismissed"]);
export const verificationStatus = z.enum(["unverified", "verified", "tentative", "not_applicable"]);
export const changeDraft = z.object({
  category: changeCategory,
  title: z.string().trim().min(3).max(160),
  sourceUrl: z.string().url().refine(officialYouTubeSource,
    "Use an official YouTube/Google or regulator HTTPS source."),
  publishedDate: day.nullable(),
  effectiveDate: day.nullable(),
  description: z.string().trim().min(5).max(1800),
  channelImpact: z.string().trim().min(3).max(1200),
  requiredAction: z.string().trim().min(3).max(1200),
  verification: verificationStatus,
  status: changeStatus,
  followUpDate: day.nullable(),
  notes: z.string().trim().max(1200),
}).strict();
export type ChangeDraft = z.infer<typeof changeDraft>;
export const changeRecord = changeDraft.extend({
  id: z.uuid(),
  workspaceId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
export type ChangeRecord = z.infer<typeof changeRecord>;
export const saveChange = z.object({
  id: z.uuid().optional(),
  value: changeDraft,
}).strict();
export const changeId = z.object({ id: z.uuid() }).strict();
