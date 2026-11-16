import { describe, expect, it } from "vitest";
import { approvedMetadataUpdate, optimizationAdvice, optimizationResult, optimizationRequest } from "../../src/shared/optimization";

const record = optimizationResult.parse({
  videoId: "abcdefghijk", channelId: "UC1234567890123456789012",
  title: "RV Solar Battery Upgrade", description: "", tags: ["RV solar", "rv solar"],
  fetchedAt: "2026-11-14T00:00:00Z",
});
describe("owner video metadata quality advice", () => {
  it("validates an exact YouTube video selection", () => {
    expect(optimizationRequest.safeParse({ videoId: "abcdefghijk" }).success).toBe(true);
    expect(optimizationRequest.safeParse({ videoId: "https://youtube.com/watch?v=abcdefghijk" }).success).toBe(false);
  });
  it("flags empty descriptions and duplicate tags without inventing performance scores", () => {
    const result = optimizationAdvice(record);
    expect(result.tips.some(t => t.field === "description")).toBe(true);
    expect(result.tips.some(t => t.label === "Remove duplicate tags")).toBe(true);
    expect(Object.hasOwn(result, "keywordVolume")).toBe(false);
  });
  it("only derives candidate phrases from words in the owner's current title", () => {
    const result = optimizationAdvice({ ...record, tags: [] });
    expect(result.candidateTags).toContain("Solar Battery");
    expect(result.candidateTags).not.toContain("viral trending");
  });
  it("offers a title-grounded description starter without changing the original", () => {
    const result = optimizationAdvice(record);
    expect(result.suggestedDescriptionOpening).toContain(record.title);
    expect(result.suggestedDescriptionOpening).toContain("truthful summary");
    expect(record.description).toBe("");
    expect(optimizationAdvice({ ...record, description: "A real summary." }).suggestedDescriptionOpening)
      .toBeNull();
  });
  it("prevents publishing an unfilled starter template, even after approval", () => {
    const suggested = optimizationAdvice(record).suggestedDescriptionOpening;
    expect(suggested).not.toBeNull();
    const input = { original: record, approved: true as const,
      proposed: { title: record.title, description: suggested!, tags: record.tags } };
    expect(approvedMetadataUpdate.safeParse(input).success).toBe(false);
    expect(approvedMetadataUpdate.safeParse({
      ...input, proposed: { ...input.proposed,
        description: "Our hands-on RV solar battery installation and what we learned." },
    }).success).toBe(true);
  });
  it("warns about front-loaded links while explicitly preserving disclosures", () => {
    const result = optimizationAdvice({
      ...record, description: "https://example.org/gear\\nAffiliate links disclosed here.",
    });
    const message = result.tips.find(t => t.label === "Consider leading with the video's story");
    expect(message?.reason).toContain("disclosures");
  });
  it("detects missing first chapter and unrelated long descriptions without inventing timestamps", () => {
    const result = optimizationAdvice({
      ...record,
      description: "This is a travel diary about a long walk in a city, restaurant options, practical travel advice, and lots of other detail unrelated to the stated video topic.\n1:20 Arrival\n2:40 Highlights",
    });
    expect(result.tips.some(t => t.label === "Check chapter timestamps")).toBe(true);
    expect(result.tips.some(t => t.label === "Connect the opening to your video title")).toBe(true);
    expect(result.tips.find(t => t.label === "Check chapter timestamps")?.reason).toContain("Do not invent");
  });
  it("does not flag valid chapters beginning at 0:00", () => {
    const result = optimizationAdvice({
      ...record,
      description: "0:00 Introduction\n1:20 Arrival\n2:40 Highlights",
    });
    expect(result.tips.some(t => t.label === "Check chapter timestamps")).toBe(false);
  });
  it("does not treat adequate basic metadata as proof of optimal reach", () => {
    const result = optimizationAdvice({ ...record, title: "A practical comparison of RV solar battery upgrades",
      description: "This is an accurate summary of the actual video, showing our RV solar system and the installed equipment with what we learned.",
      tags: ["practical comparison", "battery upgrades", "solar battery"] });
    expect(result.tips.every(t => !/guarantee|proven viral/i.test(t.reason))).toBe(true);
  });
});
