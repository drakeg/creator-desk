import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import { googleJSON, type Transport } from "./http";
export const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const desktopClient = z.object({
  client_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/)
    .max(250),
  client_secret: z.string().min(1).max(250),
});
export const tokens = z.object({
  access_token: z.string().min(1).max(10000),
  refresh_token: z.string().min(1).max(10000),
  expiresAt: z.number().finite(),
});
export type Tokens = z.infer<typeof tokens>;
export type Client = z.infer<typeof desktopClient>;
const responseToken = z.object({
  access_token: z.string().min(1).max(10000),
  refresh_token: z.string().min(1).max(10000).optional(),
  expires_in: z.number().int().positive().max(86400),
  token_type: z.literal("Bearer"),
  scope: z.string().optional(),
});
export async function exchange(
  client: Client,
  fields: Record<string, string>,
  signal: AbortSignal,
  transport?: Transport,
): Promise<Tokens> {
  const parsed = responseToken.safeParse(
    await googleJSON(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...client, ...fields }),
        signal,
      },
      transport,
    ),
  );
  if (!parsed.success)
    throw new CoreError(
      "REMOTE_ERROR",
      "Google returned an invalid token response. Connect again.",
    );
  const result = parsed.data;
  if (result.scope && !result.scope.split(" ").includes(SCOPE))
    throw new CoreError(
      "REMOTE_ERROR",
      "Google did not grant read-only YouTube access. Connect again and grant the requested permission.",
    );
  const refresh = result.refresh_token || fields.refresh_token;
  if (!refresh)
    throw new CoreError(
      "REMOTE_ERROR",
      "Google did not return offline access. Connect again and grant permission.",
    );
  return tokens.parse({
    ...result,
    refresh_token: refresh,
    expiresAt: Date.now() + result.expires_in * 1000,
  });
}
export async function authorize(
  client: Client,
  open: (url: string) => Promise<void>,
  signal: AbortSignal,
  transport?: Transport,
): Promise<Tokens> {
  if (signal.aborted) throw new CoreError("CANCELLED", "Connection cancelled.");
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let accept!: (code: string) => void;
  let reject!: (error: unknown) => void;
  const code = new Promise<string>((yes, no) => {
    accept = yes;
    reject = no;
  });
  // Attach immediately: browser launch failures and cancellation must not leave an unhandled rejection.
  void code.catch(() => {});
  let redirect = "";
  const server = createServer({ maxHeaderSize: 8192 }, (req, res) => {
    let url: URL;
    try {
      url = new URL(req.url || "/", redirect);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid authorization callback.");
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    const received = url.searchParams.get("state") || "";
    if (
      req.method !== "GET" ||
      url.pathname !== "/oauth/callback" ||
      req.headers.host !== new URL(redirect).host ||
      Buffer.byteLength(received) !== Buffer.byteLength(state) ||
      !timingSafeEqual(Buffer.from(received), Buffer.from(state))
    ) {
      res.writeHead(400);
      res.end("Invalid authorization callback.");
      return;
    }
    if (url.searchParams.has("error")) {
      res.end("Authorization was declined. Return to Creator Desk.");
      reject(
        new CoreError(
          "CANCELLED",
          "Google authorization was declined. You can connect again.",
        ),
      );
      return;
    }
    const value = url.searchParams.get("code");
    if (!value || value.length > 4096) {
      res.writeHead(400);
      res.end("Missing authorization code.");
      return;
    }
    res.end(
      "Authorization received. You can close this tab and return to Creator Desk.",
    );
    accept(value);
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxConnections = 10;
  const abort = () =>
    reject(new CoreError("CANCELLED", "Connection cancelled."));
  const timer = setTimeout(
    () =>
      reject(
        new CoreError("CANCELLED", "Google sign-in timed out. Connect again."),
      ),
    5 * 60_000,
  );
  signal.addEventListener("abort", abort, { once: true });
  try {
    await new Promise<void>((yes, no) => {
      server.once("error", no);
      server.listen(0, "127.0.0.1", yes);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Loopback listener unavailable");
    redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirect,
      response_type: "code",
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent select_account",
    }).toString();
    if (signal.aborted) abort();
    else await open(url.href);
    const value = await code;
    return await exchange(
      client,
      {
        code: value,
        code_verifier: verifier,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      },
      signal,
      transport,
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    server.close();
    server.closeAllConnections();
  }
}
