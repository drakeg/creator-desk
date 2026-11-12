import { describe, expect, it } from "vitest";
import { retentionPreset } from "../../src/shared/retention-range";

describe("retention date shortcuts", () => {
  it("uses inclusive days anchored to the latest synced date", () => {
    expect(retentionPreset("2025-01-01", "2026-11-11", 28))
      .toEqual({ startDate: "2026-10-15", endDate: "2026-11-11" });
    expect(retentionPreset("2025-01-01", "2026-11-11", 90))
      .toEqual({ startDate: "2026-08-14", endDate: "2026-11-11" });
  });
  it("clamps to the earliest available day without inventing history", () => {
    expect(retentionPreset("2026-11-01", "2026-11-11", 28))
      .toEqual({ startDate: "2026-11-01", endDate: "2026-11-11" });
    expect(retentionPreset("2026-11-01", "2026-11-11", "all"))
      .toEqual({ startDate: "2026-11-01", endDate: "2026-11-11" });
  });
  it("uses calendar days across leap years rather than local DST time", () => {
    expect(retentionPreset("2024-01-01", "2024-03-01", 28))
      .toEqual({ startDate: "2024-02-03", endDate: "2024-03-01" });
  });
  it("rejects invalid report periods", () => {
    expect(retentionPreset("2026-02-30", "2026-03-01", 28)).toBeNull();
    expect(retentionPreset("2026-11-12", "2026-11-11", 90)).toBeNull();
    expect(retentionPreset("", "2026-11-11", "all")).toBeNull();
  });
});
