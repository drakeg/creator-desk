import { describe, expect, it } from "vitest";
import { retentionFreshness } from "../../src/shared/retention-freshness";

const now = new Date("2026-11-13T12:00:00.000Z");
describe("cached retention freshness", () => {
  it("keeps a newly saved curve fresh and older curves available", () => {
    expect(retentionFreshness("2026-11-13T11:00:00.000Z", now))
      .toEqual({ ageDays: 0, stale: false });
    expect(retentionFreshness("2026-11-07T12:00:00.000Z", now))
      .toEqual({ ageDays: 6, stale: false });
    expect(retentionFreshness("2026-11-06T12:00:00.000Z", now))
      .toEqual({ ageDays: 7, stale: true });
    expect(retentionFreshness("2026-10-01T12:00:00.000Z", now))
      .toEqual({ ageDays: 43, stale: true });
  });
  it("does not report invalid or future cache timestamps as valid ages", () => {
    expect(retentionFreshness("invalid", now)).toBeNull();
    expect(retentionFreshness("2026-11-14T12:00:00.000Z", now)).toBeNull();
    expect(retentionFreshness("2026-11-13T12:00:01.000Z", now)).toBeNull();
  });
});
