import { afterEach, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  statSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../../src/main/storage/store";
import { CredentialVault } from "../../src/main/credentials";
import { AI } from "../../src/main/shorts/ai";
import { Shorts } from "../../src/main/shorts/service";
import { clip } from "../../src/shared/shorts";
const stores: Store[] = [];
afterEach(() => {
  for (const store of stores) {
    store.close();
    rmSync(store.root, { recursive: true, force: true });
  }
  stores.length = 0;
});
function setup() {
  const store = new Store(mkdtempSync(join(tmpdir(), "caption-edit-")));
  stores.push(store);
  store.create({ name: "Captions" });
  const vault = new CredentialVault(store.root, {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(s),
    decryptString: (b) => b.toString(),
  });
  let requests = 0;
  const ai = new AI(store, vault, async () => {
    requests++;
    return Response.json({ message: { content: '{"clips":[]}' } });
  });
  const path = join(store.root, "source.mp4");
  writeFileSync(path, "unchanged source");
  const stat = statSync(path);
  const id = store.state().selectedWorkspaceId!;
  mkdirSync(join(store.root, "shorts"));
  const original = { start: 1, end: 4, text: "A typo." };
  const draft = clip.parse({ start: 0, end: 8, title: "Keep my edit" });
  writeFileSync(
    join(store.root, "shorts", `${id}.json`),
    JSON.stringify({
      source: {
        path,
        name: "source.mp4",
        duration: 10,
        size: stat.size,
        mtime: stat.mtimeMs,
        token: randomUUID(),
      },
      cues: [original, { start: 5, end: 9, text: "Payoff." }],
      suggestions: [draft],
      draft,
    }),
  );
  const shorts = new Shorts(store, ai);
  const input = {
    sourceURL: shorts.state().source!.url,
    index: 0,
    original,
    updated: { start: 2, end: 4.5, text: "Corrected caption." },
  };
  return { store, shorts, ai, input, draft, requests: () => requests };
}
it("saves caption corrections locally, clears stale suggestions, and retains the clip after restart", () => {
  const { store, shorts, ai, input, draft, requests } = setup();
  const result = shorts.updateCue(input);
  expect(result.cues[0]).toEqual(input.updated);
  expect(result.suggestions).toEqual([]);
  expect(result.draft).toEqual(draft);
  expect(new Shorts(store, ai).state().cues[0]).toEqual(input.updated);
  expect(requests()).toBe(0);
});
it("rejects malformed or out-of-source corrections and preserves the previous transcript", () => {
  const { shorts, input } = setup();
  const before = shorts.state();
  for (const updated of [
    { ...input.updated, text: "   " },
    { ...input.updated, end: 1 },
    { ...input.updated, end: 10.1 },
    { ...input.updated, start: -1 },
    { ...input.updated, text: "x".repeat(2001) },
  ])
    expect(() => shorts.updateCue({ ...input, updated })).toThrow();
  expect(() => shorts.updateCue({ ...input, index: 999 })).toThrow();
  expect(shorts.state().cues).toEqual(before.cues);
  expect(shorts.state().suggestions).toEqual(before.suggestions);
});
it("rejects stale cue/source edits and edits from a different workspace", () => {
  const { store, shorts, input } = setup();
  expect(() =>
    shorts.updateCue({ ...input, sourceURL: "creator-media://media/wrong" }),
  ).toThrow();
  shorts.updateCue(input);
  expect(() => shorts.updateCue(input)).toThrow("changed");
  store.create({ name: "Different" });
  expect(() => shorts.updateCue(input)).toThrow();
  expect(shorts.state().cues).toEqual([]);
});

it("rejects caption changes during an AI job", async () => {
  const { shorts, ai, input } = setup();
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
  shorts.suggest();
  try {
    expect(() => shorts.updateCue(input)).toThrow("current job");
    expect(shorts.state().cues[0]).toEqual(input.original);
  } finally {
    await shorts.close();
  }
});

it("uses caption boundaries while retaining a valid opposite trim point", async () => {
  const { selectClipBoundary } =
    await import("../../src/shared/clip-selection");
  expect(selectClipBoundary({ start: 5, end: 45 }, "start", 10, 300)).toEqual({
    start: 10,
    end: 45,
  });
  expect(selectClipBoundary({ start: 5, end: 45 }, "end", 35, 300)).toEqual({
    start: 5,
    end: 35,
  });
  expect(selectClipBoundary({ start: 5, end: 45 }, "start", 200, 300)).toEqual({
    start: 200,
    end: 260,
  });
  expect(selectClipBoundary({ start: 200, end: 260 }, "end", 35, 300)).toEqual({
    start: 0,
    end: 35,
  });
  expect(selectClipBoundary({ start: 0, end: 300 }, "start", 10, 300)).toEqual({
    start: 10,
    end: 70,
  });
  expect(() =>
    selectClipBoundary({ start: 0, end: 10 }, "start", 9.5, 10),
  ).toThrow("one second");
  expect(() =>
    selectClipBoundary({ start: 0, end: 10 }, "end", NaN, 10),
  ).toThrow();
});

it("keeps edited paragraphs inside one timed SRT cue", async () => {
  const { srt } = await import("../../src/main/shorts/transcript");
  const output = srt(
    [{ start: 1, end: 4, text: "First line.\n\n\nSecond line." }],
    { start: 0, end: 5 },
  );
  expect(output).toBe(
    "1\n00:00:01,000 --> 00:00:04,000\nFirst line.\nSecond line.\n",
  );
});
