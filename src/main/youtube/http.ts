import { CoreError } from "../../shared/contracts";
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
/** Only use Google's machine-readable reason; never expose arbitrary remote messages
 * (which can include account identifiers or request data) to the renderer. */
export function googleFailureReason(data: unknown): string {
  if (!data || typeof data !== "object" || !("error" in data)) return "";
  const error = data.error;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  if ("errors" in error && Array.isArray(error.errors)) {
    for (const item of error.errors) {
      if (item && typeof item === "object" && "reason" in item &&
          typeof item.reason === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(item.reason))
        return item.reason;
    }
  }
  if ("status" in error && typeof error.status === "string" &&
      /^[A-Z_]{1,80}$/.test(error.status)) return error.status;
  return "";
}
export class GoogleError extends CoreError {
  constructor(
    public status: number,
    public reason: string,
  ) {
    const key = reason.toLowerCase();
    const message = reason === "invalid_grant" || status === 401
      ? "Google access expired or was revoked. Disconnect and connect again."
      : status === 403 && ["quotaexceeded", "dailylimitexceeded", "dailylimitexceededunreg", "ratelimitexceeded", "userratelimitexceeded"].includes(key)
        ? "YouTube API quota or rate limit was reached. Check your Google Cloud quota and retry after the limit resets. Your saved comments are unchanged."
      : status === 403 && ["insufficientpermissions", "forbidden", "permission_denied"].includes(key)
        ? "YouTube denied comment access for the connected account or channel. Confirm the Google account owns or manages this channel, then reconnect YouTube in Settings if its authorization changed."
      : status === 403 && ["accessnotconfigured", "service_disabled", "apidisabled"].includes(key)
        ? "The YouTube Data API v3 is disabled or unavailable for this Google Cloud project. Enable it in the project for your desktop OAuth client."
      : status === 403 && key === "commentsdisabled"
        ? "YouTube reports that comments are disabled for the requested content. No saved comments were changed."
      : status === 403
        ? "YouTube denied this request (HTTP 403). Check the connected channel, YouTube Data API enablement, account permissions and project quota. Saved data was preserved."
      : "Google could not complete the request. Check your connection and try again.";
    super("REMOTE_ERROR", message);
  }
}
export async function googleJSON(
  url: string,
  init: RequestInit,
  transport: Transport = fetch,
): Promise<unknown> {
  try {
    const response = await transport(url, {
      ...init,
      redirect: "error",
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1024 * 1024) throw new Error("Response too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!response.ok) {
      throw new GoogleError(response.status, googleFailureReason(data));
    }
    return data;
  } catch (error) {
    if (error instanceof GoogleError) throw error;
    throw new CoreError(
      "REMOTE_ERROR",
      "Google could not be reached or returned an invalid response. Your saved data is preserved. Try again.",
    );
  }
}
