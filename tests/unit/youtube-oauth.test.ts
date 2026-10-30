import { expect, it } from "vitest";
import { authorize, exchange, SCOPE } from "../../src/main/youtube/oauth";
const client = {
  client_id: "test.apps.googleusercontent.com",
  client_secret: "fixture-secret",
};
it("uses system-browser PKCE, ignores forged state and exchanges the accepted code", async () => {
  let verifier = "";
  let challenge = "";
  const result = await authorize(
    client,
    async (raw) => {
      const url = new URL(raw);
      const redirect = url.searchParams.get("redirect_uri")!;
      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.searchParams.get("scope")).toBe(SCOPE);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      challenge = url.searchParams.get("code_challenge")!;
      expect(new URL(redirect).hostname).toBe("127.0.0.1");
      const { request } = await import("node:http");
      const local = new URL(redirect);
      const malformed = await new Promise<number>((resolve, reject) => {
        const req = request(
          { hostname: local.hostname, port: local.port, path: "http://%" },
          (res) => {
            res.resume();
            resolve(res.statusCode!);
          },
        );
        req.on("error", reject);
        req.end();
      });
      expect(malformed).toBe(400);
      const forged = await fetch(`${redirect}?state=forged&code=bad`);
      expect(forged.status).toBe(400);
      const unicode = await fetch(
        `${redirect}?state=${encodeURIComponent("é".repeat(43))}&code=bad`,
      );
      expect(unicode.status).toBe(400);
      await fetch(
        `${redirect}?state=${url.searchParams.get("state")}&code=accepted`,
      );
    },
    new AbortController().signal,
    async (url, init) => {
      expect(url).toBe("https://oauth2.googleapis.com/token");
      const body = init.body as URLSearchParams;
      expect(body.get("code")).toBe("accepted");
      verifier = body.get("code_verifier")!;
      expect(body.get("redirect_uri")).toMatch(/^http:\/\/127.0.0.1:/);
      return Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: SCOPE,
      });
    },
  );
  const { createHash } = await import("node:crypto");
  expect(createHash("sha256").update(verifier).digest("base64url")).toBe(
    challenge,
  );
  expect(result.refresh_token).toBe("refresh");
});
it("supports cancelling while waiting for browser consent", async () => {
  const controller = new AbortController();
  await expect(
    authorize(
      client,
      async () => {
        controller.abort();
      },
      controller.signal,
    ),
  ).rejects.toThrow("cancelled");
});
it("retains a refresh token when Google does not rotate it", async () => {
  const result = await exchange(
    client,
    { refresh_token: "original", grant_type: "refresh_token" },
    new AbortController().signal,
    async () =>
      Response.json({
        access_token: "new",
        expires_in: 3600,
        token_type: "Bearer",
      }),
  );
  expect(result.refresh_token).toBe("original");
});
it("reports revocation without disclosing Google response bodies", async () => {
  await expect(
    exchange(
      client,
      { refresh_token: "private" },
      new AbortController().signal,
      async () =>
        Response.json(
          { error: "invalid_grant", error_description: "private" },
          { status: 400 },
        ),
    ),
  ).rejects.toThrow("revoked");
});

it("rejects oversized remote responses without exposing their contents", async () => {
  const { googleJSON } = await import("../../src/main/youtube/http");
  await expect(
    googleJSON(
      "https://oauth2.googleapis.com/token",
      {},
      async () => new Response("private".repeat(200000)),
    ),
  ).rejects.toThrow("preserved");
});
