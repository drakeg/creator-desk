import { describe, expect, it } from "vitest";
import { GoogleError, googleFailureReason, googleJSON } from "../../src/main/youtube/http";

const request = "https://www.googleapis.com/youtube/v3/commentThreads";
function denied(error: unknown, status = 403) {
  return async () => Response.json({ error }, { status });
}
describe("Google API comment error diagnostics", () => {
  it("extracts nested Google API reason without returning arbitrary messages", () => {
    expect(googleFailureReason({
      error: { code: 403, message: "Sensitive account text",
        errors: [{ domain: "youtube.commentThread", reason: "forbidden" }] },
    })).toBe("forbidden");
    expect(googleFailureReason({ error: "invalid_grant" })).toBe("invalid_grant");
    expect(googleFailureReason({ error: { status: "PERMISSION_DENIED" } })).toBe("PERMISSION_DENIED");
    expect(googleFailureReason({ error: { errors: [{ reason: "<unsafe>" }] } })).toBe("");
    expect(googleFailureReason({ error: { message: "Sensitive account text" } })).toBe("");
  });
  it.each([
    ["quotaExceeded", "quota or rate limit"],
    ["rateLimitExceeded", "quota or rate limit"],
    ["forbidden", "connected account or channel"],
    ["insufficientPermissions", "connected account or channel"],
    ["accessNotConfigured", "YouTube Data API v3"],
    ["commentsDisabled", "comments are disabled"],
  ])("maps %s into safe, actionable guidance", async (reason, expected) => {
    const error = await googleJSON(request, {}, denied({
      code: 403, message: "Do not reveal private remote data",
      errors: [{ reason }],
    })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleError);
    expect((error as GoogleError).status).toBe(403);
    expect((error as GoogleError).reason).toBe(reason);
    expect((error as GoogleError).message).toContain(expected);
    expect((error as GoogleError).message).not.toContain("private remote data");
  });
  it("handles generic 403 and preserves expired-authorization guidance", async () => {
    const denied403 = await googleJSON(request, {}, denied({ message: "secret" })).catch(e => e);
    expect(denied403).toBeInstanceOf(GoogleError);
    expect((denied403 as Error).message).toContain("HTTP 403");
    const denied401 = await googleJSON(request, {}, denied("invalid_grant", 401)).catch(e => e);
    expect((denied401 as Error).message).toContain("Disconnect and connect again");
  });
});
