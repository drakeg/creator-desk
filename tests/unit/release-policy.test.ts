import { expect, it } from "vitest";
import { releaseTarget, targets } from "../../scripts/release-policy.mjs";
it("names every native release distinctly and identifies the packaged executable", () => {
  const names = new Set<string>();
  for (const t of targets) {
    const r = releaseTarget(t.platform, t.arch, "0.3.0");
    for (const a of r.assets) {
      expect(names.has(a)).toBe(false);
      names.add(a);
    }
    expect(r.executable).toContain(
      t.platform === "darwin"
        ? "Creator Desk.app"
        : t.platform === "win32"
          ? "creator-desk.exe"
          : "creator-desk",
    );
  }
  expect(names.size).toBe(7);
});
it("rejects unsupported release targets and unsafe versions", () => {
  expect(() => releaseTarget("linux", "ia32", "0.3.0")).toThrow();
  expect(() => releaseTarget("win32", "x64", "../bad")).toThrow();
});
