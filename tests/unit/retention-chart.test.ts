import { describe, expect, it } from "vitest";
import { retentionTopLabel } from "../../src/shared/retention-chart";

describe("retention chart axis labeling", () => {
  it("avoids overlapping a top label with the 100% reference", () => {
    expect(retentionTopLabel(1)).toBeNull();
    expect(retentionTopLabel(0.75)).toBeNull();
    expect(retentionTopLabel(1.1)).toBeNull();
    expect(retentionTopLabel(1.15)).toBeNull();
  });
  it("labels clear repeat peaks without capping their true values", () => {
    expect(retentionTopLabel(1.25)).toBe("125%");
    expect(retentionTopLabel(1.4)).toBe("140%");
    expect(retentionTopLabel(2.05)).toBe("205%");
  });
  it("does not show invalid peak labels", () => {
    expect(retentionTopLabel(Number.NaN)).toBeNull();
    expect(retentionTopLabel(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
