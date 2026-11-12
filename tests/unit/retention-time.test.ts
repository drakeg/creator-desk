import { describe, expect, it } from "vitest";
import { retentionTime } from "../../src/shared/retention-time";

describe("retention elapsed time labels", () => {
  it("formats video start, middle and end without fabricating video times", () => {
    expect(retentionTime(125, 0)).toBe("0:00");
    expect(retentionTime(125, 0.5)).toBe("1:03");
    expect(retentionTime(125, 1)).toBe("2:05");
    expect(retentionTime(3723, 1)).toBe("1:02:03");
    expect(retentionTime(3600, 0.5)).toBe("30:00");
  });
  it("returns unavailable for missing, invalid or out-of-range inputs", () => {
    expect(retentionTime(undefined, 0.5)).toBeNull();
    expect(retentionTime(null, 0.5)).toBeNull();
    expect(retentionTime(0, 0.5)).toBeNull();
    expect(retentionTime(-1, 0.5)).toBeNull();
    expect(retentionTime(Number.NaN, 0.5)).toBeNull();
    expect(retentionTime(120, -0.1)).toBeNull();
    expect(retentionTime(120, 1.1)).toBeNull();
  });
});
