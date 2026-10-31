import { describe, expect, it } from "vitest";
import { releaseStatus } from "../../scripts/release-status.mjs";

describe("release publication status", () => {
  it("publishes a new version or resumes an existing draft", async () => {
    expect(await releaseStatus(new Response(null, { status: 404 }))).toBe(
      "new",
    );
    expect(await releaseStatus(Response.json({ draft: true }))).toBe("draft");
  });

  it("preserves an already published release", async () => {
    expect(await releaseStatus(Response.json({ draft: false }))).toBe(
      "published",
    );
  });

  it.each([401, 403, 429, 500])("fails closed on HTTP %i", async (status) => {
    await expect(releaseStatus(new Response(null, { status }))).rejects.toThrow(
      `GitHub release lookup failed (HTTP ${status})`,
    );
  });

  it("rejects malformed success responses instead of overwriting a release", async () => {
    await expect(releaseStatus(Response.json({}))).rejects.toThrow(
      "Invalid GitHub release response",
    );
    await expect(
      releaseStatus(Response.json({ draft: "false" })),
    ).rejects.toThrow("Invalid GitHub release response");
    await expect(releaseStatus(new Response("not JSON"))).rejects.toThrow();
  });
});
