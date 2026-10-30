import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import {
  channelSnapshot,
  type YouTubeState,
  type ChannelSnapshot,
} from "../../shared/youtube";
import { CredentialVault } from "../credentials";
import { Store } from "../storage/store";
import {
  authorize as authorizeGoogle,
  desktopClient,
  exchange,
  tokens,
  type Client,
  type Tokens,
} from "./oauth";
import { googleJSON, type Transport } from "./http";
const CLIENT = "youtube-client";
const key = (id: string) => `youtube-${id}`;
const cacheKey = (id: string) => `youtube-snapshot-${id}`;
const count = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const channels = z.object({
  items: z
    .array(
      z.object({
        id: channelSnapshot.shape.id,
        snippet: z.object({ title: z.string().min(1).max(200) }),
        statistics: z.object({
          viewCount: count.optional(),
          subscriberCount: count.optional(),
          hiddenSubscriberCount: z.boolean().optional(),
          videoCount: count.optional(),
        }),
      }),
    )
    .max(50),
});
type Authorize = (
  client: Client,
  open: (url: string) => Promise<void>,
  signal: AbortSignal,
  transport?: Transport,
) => Promise<Tokens>;
export class YouTube {
  private attempts = new Map<string, AbortController>();
  private errors = new Map<string, string>();
  constructor(
    private store: Store,
    private vault: CredentialVault,
    private open: (url: string) => Promise<void>,
    private transport: Transport = fetch,
    private authorize: Authorize = authorizeGoogle,
  ) {}
  private workspace() {
    const id = this.store.state().selectedWorkspaceId;
    if (!id)
      throw new CoreError(
        "INVALID_INPUT",
        "Select a workspace before connecting to YouTube.",
      );
    return id;
  }
  state(): YouTubeState {
    const id = this.store.state().selectedWorkspaceId;
    const parsed = channelSnapshot
      .nullable()
      .safeParse(id ? this.store.setting(cacheKey(id), null) : null);
    return {
      configured: this.vault.has(CLIENT),
      connected: !!id && this.vault.has(key(id)),
      pending: !!id && this.attempts.has(id),
      error: id ? this.errors.get(id) || null : null,
      snapshot: parsed.success ? parsed.data : null,
    };
  }
  configure(input: unknown) {
    const client = z
      .object({ installed: desktopClient })
      .parse(input).installed;
    // Keep clients with their tokens: replacing application configuration cannot silently rebind an account.
    if (
      this.store.state().workspaces.some((w) => this.vault.has(key(w.id))) ||
      this.attempts.size
    )
      throw new CoreError(
        "INVALID_INPUT",
        "Disconnect YouTube in all workspaces before replacing Google application credentials.",
      );
    this.vault.set(CLIENT, JSON.stringify(client));
    return this.state();
  }
  connect() {
    const id = this.workspace();
    if (this.attempts.has(id))
      throw new CoreError(
        "INVALID_INPUT",
        "A connection is already in progress.",
      );
    if (this.vault.has(key(id)))
      throw new CoreError(
        "INVALID_INPUT",
        "Disconnect the current account before connecting another.",
      );
    const saved = this.vault.get(CLIENT);
    if (!saved)
      throw new CoreError(
        "INVALID_INPUT",
        "Import Google Desktop app credentials first.",
      );
    const client = desktopClient.parse(JSON.parse(saved));
    const controller = new AbortController();
    this.attempts.set(id, controller);
    this.errors.delete(id);
    void this.authorize(client, this.open, controller.signal, this.transport)
      .then((value) => {
        if (!controller.signal.aborted)
          this.vault.set(key(id), JSON.stringify({ client, tokens: value }));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          this.errors.set(
            id,
            error instanceof CoreError
              ? error.message
              : "Google sign-in failed. Check your desktop OAuth configuration and try again.",
          );
      })
      .finally(() => {
        if (this.attempts.get(id) === controller) this.attempts.delete(id);
      });
    return this.state();
  }
  cancelAll() {
    for (const controller of this.attempts.values()) controller.abort();
    this.attempts.clear();
    this.errors.clear();
  }
  cancel() {
    const id = this.workspace();
    this.attempts.get(id)?.abort();
    this.attempts.delete(id);
    this.errors.delete(id);
    return this.state();
  }
  disconnect() {
    const id = this.workspace();
    this.cancel();
    this.vault.delete(key(id));
    this.store.transaction(() =>
      this.store.db
        .prepare("DELETE FROM settings WHERE key=?")
        .run(cacheKey(id)),
    );
    return this.state();
  }
  async sync() {
    const id = this.workspace();
    const saved = this.vault.get(key(id));
    if (!saved)
      throw new CoreError("INVALID_INPUT", "Connect to YouTube first.");
    const account = z
      .object({ client: desktopClient, tokens })
      .parse(JSON.parse(saved));
    const controller = new AbortController();
    let access = account.tokens;
    if (access.expiresAt <= Date.now() + 60000) {
      access = await exchange(
        account.client,
        { grant_type: "refresh_token", refresh_token: access.refresh_token },
        controller.signal,
        this.transport,
      );
      this.vault.set(key(id), JSON.stringify({ ...account, tokens: access }));
    }
    const parsed = channels.safeParse(
      await googleJSON(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&mine=true",
        {
          headers: { Authorization: `Bearer ${access.access_token}` },
          signal: controller.signal,
        },
        this.transport,
      ),
    );
    if (!parsed.success)
      throw new CoreError(
        "REMOTE_ERROR",
        "Google returned invalid channel data. Your saved snapshot is preserved.",
      );
    const result = parsed.data;
    if (result.items.length !== 1)
      throw new CoreError(
        "REMOTE_ERROR",
        "Google did not return exactly one YouTube channel. Connect again using the Google account or Brand Account for this channel.",
      );
    const channel = result.items[0]!;
    const snapshot: ChannelSnapshot = channelSnapshot.parse({
      id: channel.id,
      title: channel.snippet.title,
      views: channel.statistics.viewCount ?? null,
      subscribers: channel.statistics.hiddenSubscriberCount
        ? null
        : (channel.statistics.subscriberCount ?? null),
      videos: channel.statistics.videoCount ?? null,
      syncedAt: new Date().toISOString(),
    });
    const previous = channelSnapshot
      .nullable()
      .parse(this.store.setting(cacheKey(id), null));
    if (previous && previous.id !== snapshot.id)
      throw new CoreError(
        "REMOTE_ERROR",
        "The connected channel changed. Disconnect and reconnect to confirm the new channel.",
      );
    this.store.transaction(() =>
      this.store.db
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(cacheKey(id), JSON.stringify(snapshot)),
    );
    this.errors.delete(id);
    return this.state();
  }
}
