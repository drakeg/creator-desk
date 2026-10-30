import { CoreError } from "../../shared/contracts";
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
export class GoogleError extends CoreError {
  constructor(
    public status: number,
    public reason: string,
  ) {
    super(
      "REMOTE_ERROR",
      reason === "invalid_grant" || status === 401
        ? "Google access expired or was revoked. Disconnect and connect again."
        : status === 403
          ? "Google denied access. Check that the required YouTube Data/Analytics APIs are enabled, consent is granted, and quota is available."
          : "Google could not complete the request. Check your connection and try again.",
    );
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
      const reason =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : "";
      throw new GoogleError(response.status, reason);
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
