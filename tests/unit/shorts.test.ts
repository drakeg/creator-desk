import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/main/storage/store";
import { CredentialVault } from "../../src/main/credentials";
import { AI } from "../../src/main/shorts/ai";
import { parseTranscript, srt } from "../../src/main/shorts/transcript";
import { filters, durationFromProbe } from "../../src/main/shorts/ffmpeg";
import { clip, endpoint } from "../../src/shared/shorts";
const roots: Store[] = [];
afterEach(() => {
  for (const s of roots) {
    s.close();
    rmSync(s.root, { recursive: true, force: true });
  }
  roots.length = 0;
});
const cues = parseTranscript(
  "1\n00:00:01,000 --> 00:00:04,000\nAn opening.\n\n2\n00:00:04,000 --> 00:00:08,000\nThe payoff.",
  10,
);
function setup(transport: ConstructorParameters<typeof AI>[2]) {
  const store = new Store(mkdtempSync(join(tmpdir(), "shorts-")));
  roots.push(store);
  store.create({ name: "Shorts" });
  const vault = new CredentialVault(store.root, {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(s.split("").reverse().join("")),
    decryptString: (b) => b.toString().split("").reverse().join(""),
  });
  return { store, ai: new AI(store, vault, transport) };
}
it("parses timed captions, clips offsets, and rejects invalid timing", () => {
  expect(cues[0]).toMatchObject({ start: 1, end: 4 });
  expect(srt(cues, { start: 2, end: 6 })).toContain(
    "00:00:00,000 --> 00:00:02,000",
  );
  expect(() =>
    parseTranscript("1\n00:00:08,000 --> 00:00:07,000\nBad", 10),
  ).toThrow();
  expect(() =>
    parseTranscript("WEBVTT\n\n00:00.000 --> 00:12.000\nToo long", 10),
  ).toThrow();
  expect(
    clip.safeParse({ start: 0, end: 181, title: "Too long" }).success,
  ).toBe(false);
});
it("restricts cleartext endpoints and generates numeric-only framing filters", () => {
  expect(endpoint.safeParse("http://169.254.169.254").success).toBe(false);
  expect(endpoint.safeParse("http://localhost:11434").success).toBe(true);
  expect(endpoint.safeParse("https://user:password@example.com").success).toBe(
    false,
  );
  expect(
    filters(clip.parse({ start: 1, end: 5, title: "Safe", focus: 0.25 })),
  ).toContain("(iw-ow)*0.25");
  expect(durationFromProbe("Duration: 01:02:03.50 Video: h264")).toBe(3723.5);
});
it("requires data permission, keeps keys protected, and validates Ollama cue selections", async () => {
  let calls = 0;
  const { ai, store } = setup(async (url, init) => {
    calls++;
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(false);
    expect(body.model).toBe("my-local-model");
    expect(body.tools).toBeUndefined();
    return Response.json({
      message: {
        content: JSON.stringify({
          clips: [
            {
              startCue: 0,
              endCue: 1,
              title: "Hook",
              reason: "Clear payoff",
              score: 80,
            },
          ],
        }),
      },
    });
  });
  const config = {
    purpose: "clips",
    kind: "ollama",
    baseURL: "http://localhost:11434",
    model: "my-local-model",
    allowed: false,
  } as const;
  ai.save({ config, apiKey: "private-test-key" });
  await expect(
    ai.suggest(cues, 10, new AbortController().signal, () => {}),
  ).rejects.toThrow("Allow");
  expect(calls).toBe(0);
  ai.save({ config: { ...config, allowed: true }, apiKey: "private-test-key" });
  const suggestions = await ai.suggest(
    cues,
    10,
    new AbortController().signal,
    () => {},
  );
  expect(suggestions[0]).toMatchObject({ start: 1, end: 8, title: "Hook" });
  expect(JSON.stringify(ai.status())).not.toContain("private-test-key");
  expect(
    readFileSync(join(store.root, "credentials.json"), "utf8"),
  ).not.toContain("private-test-key");
});
it("rejects fabricated cue IDs without exporting or executing model output", async () => {
  const { ai } = setup(async () =>
    Response.json({
      message: {
        content: JSON.stringify({
          clips: [
            {
              startCue: 999,
              endCue: 999,
              title: "bad",
              reason: "bad",
              score: 100,
            },
          ],
        }),
      },
    }),
  );
  ai.save({
    config: {
      purpose: "clips",
      kind: "ollama",
      baseURL: "http://localhost:11434",
      model: "fixture",
      allowed: true,
    },
    apiKey: "",
  });
  await expect(
    ai.suggest(cues, 10, new AbortController().signal, () => {}),
  ).rejects.toThrow("outside");
});

it("uses the selected compatible endpoint and sends no request after cancellation", async () => {
  let calls = 0;
  const { ai } = setup(async (url, init) => {
    calls++;
    expect(url).toBe("https://provider.example/v1/chat/completions");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer private-key",
    );
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ clips: [] }) } }],
    });
  });
  ai.save({
    config: {
      purpose: "clips",
      kind: "compatible",
      baseURL: "https://provider.example/v1",
      model: "chosen-model",
      allowed: true,
    },
    apiKey: "private-key",
  });
  await ai.suggest(cues, 10, new AbortController().signal, () => {});
  expect(calls).toBe(1);
  const abort = new AbortController();
  abort.abort();
  await expect(ai.suggest(cues, 10, abort.signal, () => {})).rejects.toThrow(
    "cancelled",
  );
  expect(calls).toBe(1);
});

it("requires separate permission for speech and does not expose endpoint credentials after reconfiguration", async () => {
  const { ai } = setup(async () => {
    throw new Error("Must not be contacted");
  });
  ai.save({
    config: {
      purpose: "speech",
      kind: "compatible",
      baseURL: "http://localhost:8080/v1",
      model: "chosen-speech",
      allowed: false,
    },
    apiKey: "",
  });
  await expect(
    ai.transcribe("/not/read", 0, new AbortController().signal),
  ).rejects.toThrow("Allow");
  expect(JSON.stringify(ai.status())).not.toContain("apiKey");
});

it("cancels an in-flight suggestion job without replacing saved suggestions", async () => {
  const { Shorts } = await import("../../src/main/shorts/service");
  const { writeFileSync, mkdirSync, statSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");
  const { store, ai } = setup(
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  );
  ai.save({
    config: {
      purpose: "clips",
      kind: "ollama",
      baseURL: "http://localhost:11434",
      model: "fixture",
      allowed: true,
    },
    apiKey: "",
  });
  const path = join(store.root, "source.mp4");
  writeFileSync(path, "synthetic");
  const stat = statSync(path);
  const id = store.state().selectedWorkspaceId!;
  mkdirSync(join(store.root, "shorts"));
  const old = clip.parse({ start: 1, end: 5, title: "Preserved draft" });
  writeFileSync(
    join(store.root, "shorts", `${id}.json`),
    JSON.stringify({
      source: {
        path,
        name: "source.mp4",
        size: stat.size,
        mtime: stat.mtimeMs,
        duration: 10,
        token: randomUUID(),
      },
      cues,
      suggestions: [old],
      draft: old,
    }),
  );
  const shorts = new Shorts(store, ai);
  expect(shorts.suggest().job).not.toBe(null);
  shorts.cancel();
  await shorts.close();
  expect(shorts.state().suggestions[0]?.title).toBe("Preserved draft");
  expect(shorts.state().error).toContain("cancelled");
});

it("serves only selected source ranges in the current workspace", async () => {
  const { Shorts } = await import("../../src/main/shorts/service");
  const { writeFileSync, mkdirSync, statSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");
  const { store, ai } = setup(async () => Response.json({}));
  const path = join(store.root, "source.mp4");
  writeFileSync(path, "0123456789");
  const stat = statSync(path);
  const id = store.state().selectedWorkspaceId!;
  const token = randomUUID();
  mkdirSync(join(store.root, "shorts"));
  writeFileSync(
    join(store.root, "shorts", `${id}.json`),
    JSON.stringify({
      source: {
        path,
        name: "source.mp4",
        size: stat.size,
        mtime: stat.mtimeMs,
        duration: 10,
        token,
      },
      cues: [],
      suggestions: [],
      draft: null,
    }),
  );
  const shorts = new Shorts(store, ai);
  const url = `creator-media://media/${token}`;
  const response = shorts.response(
    new Request(url, { headers: { Range: "bytes=2-5" } }),
  );
  expect(response.status).toBe(206);
  expect(await response.text()).toBe("2345");
  expect(
    shorts.response(new Request("creator-media://media/not-authorized")).status,
  ).toBe(404);
  store.create({ name: "Another workspace" });
  expect(shorts.response(new Request(url)).status).toBe(404);
});

it("stops a running media process when cancelled", async () => {
  const { runFFmpeg } = await import("../../src/main/shorts/ffmpeg");
  const controller = new AbortController();
  const promise = runFFmpeg(
    process.execPath,
    ["-e", "setTimeout(()=>{},10000)"],
    controller.signal,
    undefined,
    5000,
  );
  setTimeout(() => controller.abort(), 50);
  await expect(promise).rejects.toThrow("cancelled");
});

it("does not forward a saved key to a different restored endpoint", async () => {
  let calls = 0;
  const { store, ai } = setup(async () => {
    calls++;
    return Response.json({});
  });
  const config = {
    purpose: "clips",
    kind: "compatible",
    baseURL: "https://original.example/v1",
    model: "chosen",
    allowed: true,
  } as const;
  ai.save({ config, apiKey: "private-key" });
  store.db
    .prepare("UPDATE settings SET value=? WHERE key=?")
    .run(
      JSON.stringify({ ...config, baseURL: "https://different.example/v1" }),
      "ai-clips",
    );
  await expect(
    ai.suggest(cues, 10, new AbortController().signal, () => {}),
  ).rejects.toThrow("AI request failed");
  expect(calls).toBe(0);
});
