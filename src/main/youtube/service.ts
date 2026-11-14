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
  ANALYTICS_SCOPE,
  tokens,
  type Client,
  type Tokens,
} from "./oauth";
import { reachSetup, type ReachOverview } from "../../shared/reach";
import { ReachCache } from "./reach-cache";
import { RetentionCache } from "./retention-cache";
import { fetchVideoRetention } from "./retention";
import { retentionQuery, type RetentionQuery } from "../../shared/retention";
import { ingestReachReports } from "./reach-ingest";
import { readReachOverview, reachSetupKey } from "./reach-overview";
import { Reporting } from "./reporting";
import { History, historicalDaily } from "./history";
import { Reports } from "../imports/reports";
import { dailyReport, uploadReport } from "./report-data";
import { dailySyncInput, type DailySyncInput } from "../../shared/youtube";
import { googleJSON, type Transport } from "./http";
import { researchInput, searchResponse, videosResponse, combineResearchResults } from "../../shared/research";
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
        snippet: z.object({
          title: z.string().min(1).max(200),
          publishedAt: z.iso.datetime({ offset: true }).optional(),
        }),
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
  private syncs = new Map<
    string,
    { controller: AbortController; message: string }
  >();
  private reachControllers = new Map<string, AbortController>();
  private retentionControllers = new Map<string, AbortController>();
  private reachRefreshes = new Map<string, Promise<ReachOverview>>();
  private reachJobs = new Map<
    string,
    Promise<Awaited<ReturnType<Reporting["ensureReachJob"]>>>
  >();
  private attempts = new Map<string, AbortController>();
  private errors = new Map<string, string>();
  constructor(
    private store: Store,
    private vault: CredentialVault,
    private open: (url: string) => Promise<void>,
    private transport: Transport = (url, init) => fetch(url, init),
    private authorize: Authorize = authorizeGoogle,
    private appClient: Client | null = null,
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
      configured: this.vault.has(CLIENT) || !!this.appClient,
      appClientAvailable: !!this.appClient,
      clientSource: this.vault.has(CLIENT)
        ? "custom"
        : this.appClient
          ? "app"
          : "none",
      connected: !!id && this.vault.has(key(id)),
      pending: !!id && this.attempts.has(id),
      error: id ? this.errors.get(id) || null : null,
      snapshot: parsed.success ? parsed.data : null,
      reachSync: !!id && this.reachControllers.has(id),
      sync:
        id && this.syncs.has(id)
          ? { message: this.syncs.get(id)!.message }
          : null,
    };
  }
  configure(input: unknown) {
    const client = z
      .object({ installed: desktopClient })
      .parse(input).installed;
    this.requireConfigurable();
    this.vault.set(CLIENT, JSON.stringify(client));
    return this.state();
  }
  private requireConfigurable() {
    // Keep clients with their tokens: replacing application configuration cannot silently rebind an account.
    if (
      this.store.state().workspaces.some((w) => this.vault.has(key(w.id))) ||
      this.attempts.size
    )
      throw new CoreError(
        "INVALID_INPUT",
        "Disconnect YouTube in all workspaces before replacing Google application credentials.",
      );
  }
  useAppClient() {
    if (!this.appClient)
      throw new CoreError(
        "INVALID_INPUT",
        "This build does not include a Creator Desk Google client.",
      );
    this.requireConfigurable();
    this.vault.delete(CLIENT);
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
    const saved = this.vault.has(CLIENT) ? this.vault.get(CLIENT) : null;
    const client = saved
      ? desktopClient.parse(JSON.parse(saved))
      : this.appClient;
    if (!client)
      throw new CoreError(
        "INVALID_INPUT",
        "Import Google Desktop app credentials first, or use a build configured by the publisher.",
      );
    this.vault.assertAvailable();
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
    for (const controller of this.retentionControllers.values()) controller.abort();
    this.retentionControllers.clear();
    for (const controller of this.reachControllers.values()) controller.abort();
    this.reachControllers.clear();
    this.reachJobs.clear();
    this.reachRefreshes.clear();
    for (const job of this.syncs.values()) job.controller.abort();
    this.syncs.clear();
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
    this.syncs.get(id)?.controller.abort();
    this.reachControllers.get(id)?.abort();
    this.retentionControllers.get(id)?.abort();
    this.vault.delete(key(id));
    this.store.transaction(() =>
      this.store.db
        .prepare("DELETE FROM settings WHERE key=?")
        .run(cacheKey(id)),
    );
    return this.state();
  }
  private async access(id: string, analytics = false) {
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
        access.scopes,
      );
      if (!this.vault.has(key(id)) || this.vault.get(key(id)) !== saved)
        throw new CoreError(
          "CANCELLED",
          "The channel connection changed. Try again.",
        );
      this.vault.set(key(id), JSON.stringify({ ...account, tokens: access }));
    }
    if (analytics && !access.scopes.includes(ANALYTICS_SCOPE))
      throw new CoreError(
        "REMOTE_ERROR",
        "Daily analytics needs an additional read-only permission. Disconnect and reconnect YouTube in Settings, granting both requested permissions.",
      );
    return access.access_token;
  }
  async sync(
    transport: Transport = this.transport,
    guard: () => void = () => {},
  ) {
    const id = this.workspace();
    const access = await this.access(id);
    const parsed = channels.safeParse(
      await googleJSON(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&mine=true",
        {
          headers: { Authorization: `Bearer ${access}` },
        },
        transport,
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
      ...(channel.snippet.publishedAt
        ? { createdAt: channel.snippet.publishedAt }
        : {}),
    });
    const previous = channelSnapshot
      .nullable()
      .parse(this.store.setting(cacheKey(id), null));
    if (previous && previous.id !== snapshot.id)
      throw new CoreError(
        "REMOTE_ERROR",
        "The connected channel changed. Disconnect and reconnect to confirm the new channel.",
      );
    if (this.workspace() !== id || !this.vault.has(key(id)))
      throw new CoreError(
        "CANCELLED",
        "The selected channel changed. Sync again.",
      );
    guard();
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

  async syncDaily(input: DailySyncInput) {
    const range = dailySyncInput.parse(input);
    const id = this.workspace();
    const token = await this.access(id, true);
    await this.sync();
    const channel = this.state().snapshot!;
    const data = await dailyReport(token, channel.id, range, this.transport);
    if (this.workspace() !== id)
      throw new CoreError(
        "CANCELLED",
        "The workspace changed. Sync again in the intended workspace.",
      );
    return new Reports(this.store).saveYouTube(data!, {
      channelName: channel.title.slice(0, 100),
      channelId: channel.id,
      source: "youtube-daily",
      fileName: "YouTube daily analytics",
      periodStart: data!.rows[0]!.date,
      periodEnd: data!.rows.at(-1)!.date,
    });
  }
  /** A deliberate, user-triggered vidIQ-style discovery search, not background polling.
   * A conservative daily allowance protects the shared YouTube API quota.
   */
  async research(input: unknown) {
    const { query } = researchInput.parse(input);
    const id = this.workspace();
    const connection = this.state();
    if (!connection.connected || !connection.snapshot)
      throw new CoreError("INVALID_INPUT", "Connect and sync your own YouTube channel before researching topics.");
    const quotaKey = `research-quota:${id}`;
    const today = new Date().toISOString().slice(0, 10);
    const saved = z.object({
      date: z.string(),
      count: z.number().int().min(0).max(20),
    }).safeParse(this.store.setting(quotaKey, { date: today, count: 0 }));
    const used = saved.success && saved.data.date === today ? saved.data.count : 0;
    if (used >= 20)
      throw new CoreError("INVALID_INPUT", "Research limit reached for today (20 searches). Try again tomorrow.");
    const token = await this.access(id);
    if (this.workspace() !== id)
      throw new CoreError("CANCELLED", "Channel changed. Search cancelled.");
    // Reserve a request before making network calls; a failed call can still consume quota.
    this.store.transaction(() => {
      const current = z.object({ date: z.string(), count: z.number().int().min(0).max(20) })
        .safeParse(this.store.setting(quotaKey, { date: today, count: 0 }));
      const count = current.success && current.data.date === today ? current.data.count : 0;
      if (count >= 20) throw new CoreError("INVALID_INPUT", "Research search limit reached for today.");
      this.store.db.prepare(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(quotaKey, JSON.stringify({ date: today, count: count + 1 }));
    });
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: "10",
      order: "relevance",
      safeSearch: "moderate",
    }).toString();
    const search = searchResponse.safeParse(await googleJSON(
      url.href, { headers: { Authorization: `Bearer ${token}` } }, this.transport,
    ));
    if (!search.success)
      throw new CoreError("REMOTE_ERROR", "YouTube returned invalid search metadata. No results were saved.");
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.search = new URLSearchParams({
      part: "statistics",
      id: search.data.items.map((item) => item.id.videoId).join(","),
    }).toString();
    const details = search.data.items.length
      ? videosResponse.safeParse(await googleJSON(
          detailsUrl.href, { headers: { Authorization: `Bearer ${token}` } }, this.transport,
        ))
      : videosResponse.safeParse({ items: [] });
    if (!details.success)
      throw new CoreError("REMOTE_ERROR", "YouTube returned invalid video statistics. No results were saved.");
    if (this.workspace() !== id || !this.state().connected ||
        this.state().snapshot?.id !== connection.snapshot.id)
      throw new CoreError("CANCELLED", "Channel changed during research. Results discarded.");
    return combineResearchResults(query, search.data, details.data,
      new Date().toISOString(), 20 - Number(
        z.object({ date: z.string(), count: z.number().int().min(0).max(20) })
          .parse(this.store.setting(quotaKey, { date: today, count: 20 })).count,
      ));
  }
  async syncUploads() {
    const id = this.workspace();
    const token = await this.access(id);
    await this.sync();
    const channel = this.state().snapshot!;
    const playlist = await this.uploadsPlaylist(
      token,
      channel.id,
      this.transport,
    );
    const data = await uploadReport(
      token,
      playlist,
      channel.id,
      this.transport,
    );
    if (this.workspace() !== id)
      throw new CoreError(
        "CANCELLED",
        "The workspace changed. Sync again in the intended workspace.",
      );
    return new Reports(this.store).saveYouTube(data, {
      channelName: channel.title.slice(0, 100),
      channelId: channel.id,
      source: "youtube-uploads",
      fileName: "YouTube uploads (cumulative views)",
      periodStart: null,
      periodEnd: null,
    });
  }
  private async uploadsPlaylist(
    token: string,
    channelId: string,
    transport: Transport,
  ) {
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.search = new URLSearchParams({
      part: "contentDetails",
      id: channelId,
    }).toString();
    const response = z
      .object({
        items: z
          .array(
            z.object({
              id: z.literal(channelId),
              contentDetails: z.object({
                relatedPlaylists: z.object({
                  uploads: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
                }),
              }),
            }),
          )
          .length(1),
      })
      .safeParse(
        await googleJSON(
          url.href,
          { headers: { Authorization: `Bearer ${token}` } },
          transport,
        ),
      );
    if (!response.success)
      throw new CoreError(
        "REMOTE_ERROR",
        "YouTube did not return the channel uploads playlist.",
      );
    return response.data.items[0]!.contentDetails.relatedPlaylists.uploads;
  }
  history() {
    return new History(this.store).load(this.workspace());
  }
  cancelSync() {
    this.syncs.get(this.workspace())?.controller.abort();
    this.reachControllers.get(this.workspace())?.abort();
    return null;
  }
  async syncHistory() {
    const id = this.workspace();
    if (this.syncs.has(id))
      throw new CoreError(
        "INVALID_INPUT",
        "Channel history is already syncing.",
      );
    const job = {
      controller: new AbortController(),
      message: "Reading channel details…",
    };
    this.syncs.set(id, job);
    const check = () => {
      if (
        job.controller.signal.aborted ||
        this.workspace() !== id ||
        !this.vault.has(key(id))
      )
        throw new CoreError(
          "CANCELLED",
          "Sync stopped. Your previous channel history is unchanged.",
        );
    };
    const transport: Transport = async (url, init) => {
      check();
      const response = await this.transport(url, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, job.controller.signal])
          : job.controller.signal,
      });
      check();
      return response;
    };
    try {
      const token = await this.access(id, true);
      check();
      await this.sync(transport, check);
      check();
      const channel = this.state().snapshot!;
      const created = channel.createdAt?.slice(0, 10) ?? "2005-01-01";
      const endDate = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      const startDate = created > endDate ? endDate : created;
      const daily = await historicalDaily(
        token,
        channel.id,
        startDate,
        endDate,
        transport,
        (message) => {
          job.message = message;
        },
      );
      job.message = "Reading the full video library…";
      const playlist = await this.uploadsPlaylist(token, channel.id, transport);
      const uploads = await uploadReport(
        token,
        playlist,
        channel.id,
        transport,
        true,
      );
      check();
      job.message = "Saving channel history…";
      return new History(this.store).save(
        id,
        channel.id,
        channel.title,
        startDate,
        endDate,
        daily,
        uploads,
      );
    } catch (error) {
      check();
      throw error;
    } finally {
      if (this.syncs.get(id) === job) this.syncs.delete(id);
    }
  }
  private runReach<T>(
    operation: (context: {
      id: string;
      channel: ChannelSnapshot;
      token: string;
      transport: Transport;
      guard: () => void;
      reporting: Reporting;
    }) => Promise<T>,
  ) {
    const id = this.workspace();
    if (this.reachControllers.has(id))
      throw new CoreError(
        "INVALID_INPUT",
        "Reach is already refreshing for this channel.",
      );
    const controller = new AbortController();
    this.reachControllers.set(id, controller);
    let account: string | null = null;
    const check = () => {
      if (controller.signal.aborted)
        throw new CoreError(
          "CANCELLED",
          "Reach refresh stopped. Saved reach history is unchanged.",
        );
      if (
        this.workspace() !== id ||
        !this.vault.has(key(id)) ||
        (account !== null && this.vault.get(key(id)) !== account)
      )
        throw new CoreError(
          "CANCELLED",
          "The selected channel changed. Reporting setup stopped.",
        );
    };
    const transport: Transport = async (url, init) => {
      check();
      const response = await this.transport(url, {
        ...init,
        signal: init.signal
          ? AbortSignal.any([init.signal, controller.signal])
          : controller.signal,
      });
      check();
      return response;
    };
    return (async () => {
      const token = await this.access(id, true);
      account = this.vault.get(key(id));
      check();
      await this.sync(transport, check);
      check();
      return operation({
        id,
        channel: this.state().snapshot!,
        token,
        transport,
        guard: check,
        reporting: new Reporting(token, transport, check),
      });
    })().finally(() => {
      if (this.reachControllers.get(id) === controller)
        this.reachControllers.delete(id);
    });
  }

  /** Read saved curves without network access, including after disconnect.
   * Workspace-scoped cache keys still prevent cross-workspace reads. A connected
   * channel snapshot must agree with the requested identity.
   */
  retention(input: RetentionQuery) {
    const query = retentionQuery.parse(input);
    const workspaceId = this.workspace();
    const channel = this.state().snapshot;
    if (channel && query.channelId !== channel.id) {
      throw new CoreError("INVALID_INPUT", "Choose a video from the selected YouTube channel.");
    }
    // If a connection is active but has not yet established its channel,
    // require a fresh snapshot before exposing a previous channel's history.
    if (this.vault.has(key(workspaceId)) && !channel) {
      throw new CoreError("INVALID_INPUT", "Sync the connected YouTube channel before opening retention history.");
    }
    return new RetentionCache(this.store).read(query);
  }

  cancelRetention() {
    this.retentionControllers.get(this.workspace())?.abort();
    return null;
  }

  async syncRetention(input: RetentionQuery) {
    const query = retentionQuery.parse(input);
    const id = this.workspace();
    if (this.retentionControllers.has(id)) {
      throw new CoreError("INVALID_INPUT", "A retention refresh is already running for this channel.");
    }
    const channel = this.state().snapshot;
    if (!channel || channel.id !== query.channelId) {
      throw new CoreError("INVALID_INPUT", "Choose a video from the selected YouTube channel.");
    }
    const controller = new AbortController();
    this.retentionControllers.set(id, controller);
    try {
      const token = await this.access(id, true);
      // Refreshing an expired token may update the vault. Capture the active
      // account identity after access, without confusing a refresh for a switch.
      const refreshedAccount = this.vault.get(key(id));
      if (!refreshedAccount || this.workspace() !== id || controller.signal.aborted ||
          this.state().snapshot?.id !== channel.id) {
        throw new CoreError("CANCELLED", "Retention refresh stopped. Previous history is unchanged.");
      }
      const checked = () => {
        if (controller.signal.aborted || this.workspace() !== id ||
            this.vault.get(key(id)) !== refreshedAccount ||
            this.state().snapshot?.id !== channel.id) {
          throw new CoreError("CANCELLED", "Retention refresh stopped. Previous history is unchanged.");
        }
      };
      // All subsequent transport requests are guarded against account switches.
      const guardedTransport: Transport = async (url, init) => {
        checked();
        const response = await this.transport(url, {
          ...init,
          signal: init.signal
            ? AbortSignal.any([init.signal, controller.signal])
            : controller.signal,
        });
        checked();
        return response;
      };
      let points;
      try {
        points = await fetchVideoRetention(
          token, query, guardedTransport, controller.signal,
        );
      } catch (error) {
        // The shared HTTP helper may normalize an aborted request into a
        // transport error. Prefer the actual cancellation/account guard.
        checked();
        throw error;
      }
      checked();
      return new RetentionCache(this.store).save(query, points, checked);
    } finally {
      if (this.retentionControllers.get(id) === controller) {
        this.retentionControllers.delete(id);
      }
    }
  }

  prepareReachJob() {
    const id = this.workspace(),
      pending = this.reachJobs.get(id);
    if (pending) return pending;
    const task = this.runReach((context) =>
      context.reporting.ensureReachJob(),
    ).finally(() => {
      if (this.reachJobs.get(id) === task) this.reachJobs.delete(id);
    });
    this.reachJobs.set(id, task);
    return task;
  }
  reach(input: unknown = {}) {
    const id = this.workspace();
    const channelId =
      this.state().snapshot?.id ??
      new History(this.store).load(id)?.channelId ??
      null;
    return readReachOverview(
      this.store,
      channelId,
      input,
      this.reachControllers.has(id),
    );
  }
  cancelReach() {
    this.reachControllers.get(this.workspace())?.abort();
    return null;
  }
  syncReach() {
    const id = this.workspace(),
      pending = this.reachRefreshes.get(id);
    if (pending) return pending;
    const task = this.runReach(async (context) => {
      const result = await context.reporting.ensureReachJob();
      context.guard();
      const previous = reachSetup
        .nullable()
        .parse(this.store.setting(reachSetupKey(id), null));
      const setup = reachSetup.parse({
        workspaceId: id,
        channelId: context.channel.id,
        jobId: result.job.id,
        jobCreatedAt: result.job.createTime,
        checkedAt:
          previous?.channelId === context.channel.id
            ? previous.checkedAt
            : null,
      });
      const put = () =>
        this.store.db
          .prepare(
            "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          )
          .run(reachSetupKey(id), JSON.stringify(setup));
      this.store.transaction(put);
      await ingestReachReports(
        context.token,
        result.job.id,
        id,
        context.channel.id,
        context.transport,
        new ReachCache(this.store, context.channel.id),
        context.guard,
      );
      context.guard();
      setup.checkedAt = new Date().toISOString();
      this.store.transaction(put);
      return { ...this.reach({}), busy: false };
    }).finally(() => {
      if (this.reachRefreshes.get(id) === task) this.reachRefreshes.delete(id);
    });
    this.reachRefreshes.set(id, task);
    return task;
  }
}
