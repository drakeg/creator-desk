import { describe, expect, it } from "vitest";
import { optimizationAdvice, optimizationResult, optimizationRequest } from "../../src/shared/optimization";

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
  it("does not treat adequate basic metadata as proof of optimal reach", () => {
    const result = optimizationAdvice({ ...record, title: "A practical comparison of RV solar battery upgrades",
      description: "This is an accurate summary of the actual video, showing our RV solar system and the installed equipment with what we learned.",
      tags: ["practical comparison", "battery upgrades", "solar battery"] });
    expect(result.tips.every(t => !/guarantee|proven viral/i.test(t.reason))).toBe(true);
  });
});
