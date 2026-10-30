import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  renameSync,
  statSync,
  createReadStream,
  closeSync,
  readSync,
} from "node:fs";
import {
  join,
  basename,
  dirname,
  resolve,
  isAbsolute,
  extname,
} from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CoreError } from "../../shared/contracts";
import { clip, cue, type ShortsState } from "../../shared/shorts";
import { Store } from "../storage/store";
import { atomicWrite, openRegularFile } from "../storage/files";
import { AI } from "./ai";
import { demuxer, durationFromProbe, filters, runFFmpeg } from "./ffmpeg";
import { parseTranscript, validateCues, srt } from "./transcript";
const sourceSchema = z.object({
  path: z.string().max(4000).refine(isAbsolute),
  name: z.string().max(255),
  duration: z.number().positive().max(21600),
  size: z.number().nonnegative(),
  mtime: z.number(),
  token: z.uuid(),
});
const projectSchema = z
  .object({
    source: sourceSchema.nullable(),
    cues: z.array(cue).max(10000),
    suggestions: z.array(clip).max(8),
    draft: clip.nullable(),
  })
  .strict();
type Project = z.infer<typeof projectSchema>;
interface Job {
  workspace: string;
  type: string;
  progress: number;
  controller: AbortController;
  promise: Promise<void>;
}
export class Shorts {
  private projects = new Map<string, Project>();
  private job: Job | null = null;
  private error: string | null = null;
  private notice: string | null = null;
  constructor(
    private store: Store,
    readonly ai: AI,
  ) {}
  private workspace() {
    const id = this.store.state().selectedWorkspaceId;
    if (!id) throw new CoreError("INVALID_INPUT", "Select a workspace first.");
    return id;
  }
  private path(id: string) {
    return join(this.store.root, "shorts", `${id}.json`);
  }
  private project(id = this.workspace()): Project {
    let project = this.projects.get(id);
    if (!project) {
      const path = this.path(id);
      if (existsSync(path)) {
        if (statSync(path).size > 3 * 1024 * 1024)
          throw new CoreError(
            "INVALID_INPUT",
            "Shorts draft exceeds its supported size.",
          );
        project = projectSchema.parse(JSON.parse(readFileSync(path, "utf8")));
      } else project = { source: null, cues: [], suggestions: [], draft: null };
      this.projects.set(id, project);
    }
    return project;
  }
  private save(id: string, project: Project) {
    projectSchema.parse(project);
    mkdirSync(dirname(this.path(id)), { recursive: true, mode: 0o700 });
    atomicWrite(this.path(id), JSON.stringify(project));
    this.projects.set(id, project);
  }
  executable() {
    const saved = this.store.setting<string>("ffmpeg-executable", "");
    return saved && isAbsolute(saved) && existsSync(saved) ? saved : null;
  }
  private tool() {
    const path = this.executable();
    if (!path)
      throw new CoreError(
        "INVALID_INPUT",
        "Select your installed FFmpeg executable first.",
      );
    return path;
  }
  async chooseTool(path: string) {
    if (this.job)
      throw new CoreError("INVALID_INPUT", "Cancel the current job first.");
    if (!isAbsolute(path))
      throw new CoreError("INVALID_INPUT", "Choose a local FFmpeg executable.");
    const result = await runFFmpeg(
      path,
      ["-version"],
      new AbortController().signal,
      undefined,
      10000,
    );
    if (!result.startsWith("ffmpeg version"))
      throw new CoreError(
        "INVALID_INPUT",
        "This executable did not identify itself as FFmpeg.",
      );
    this.store.transaction(() =>
      this.store.db
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run("ffmpeg-executable", JSON.stringify(path)),
    );
    return this.state();
  }
  private source(id = this.workspace()) {
    const source = this.project(id).source;
    if (!source) throw new CoreError("INVALID_INPUT", "Choose a video first.");
    const fd = openRegularFile(source.path, 20 * 1024 ** 3);
    closeSync(fd);
    const stat = statSync(source.path);
    if (stat.size !== source.size || stat.mtimeMs !== source.mtime)
      throw new CoreError(
        "INVALID_INPUT",
        "The source video changed. Choose it again before continuing.",
      );
    return source;
  }
  state(): ShortsState {
    const id = this.workspace(),
      p = this.project(id);
    return {
      source: p.source
        ? {
            name: p.source.name,
            duration: p.source.duration,
            url: `creator-media://media/${p.source.token}`,
          }
        : null,
      cues: p.cues,
      suggestions: p.suggestions,
      draft: p.draft,
      job: this.job
        ? {
            type:
              this.job.workspace === id
                ? this.job.type
                : "Working in another workspace",
            progress: this.job.progress,
          }
        : null,
      error: this.error,
      notice: this.notice,
      ffmpegReady: !!this.executable(),
      providers: this.ai.status(),
    };
  }
  async chooseVideo(path: string) {
    if (this.job)
      throw new CoreError(
        "INVALID_INPUT",
        "Cancel the current job before changing videos.",
      );
    const id = this.workspace();
    const fd = openRegularFile(path, 20 * 1024 ** 3);
    closeSync(fd);
    const stat = statSync(path);
    const output = await runFFmpeg(
      this.tool(),
      [
        "-hide_banner",
        "-nostdin",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        demuxer(path),
        "-i",
        path,
      ],
      new AbortController().signal,
      undefined,
      15000,
      true,
    );
    const duration = durationFromProbe(output);
    this.save(id, {
      source: {
        path,
        name: basename(path),
        duration,
        size: stat.size,
        mtime: stat.mtimeMs,
        token: randomUUID(),
      },
      cues: [],
      suggestions: [],
      draft: clip.parse({
        start: 0,
        end: Math.min(duration, 60),
        title: "My Short",
      }),
    });
    this.error = null;
    this.notice = null;
    return this.state();
  }
  importTranscript(path: string) {
    if (this.job)
      throw new CoreError("INVALID_INPUT", "Cancel the current job first.");
    const source = this.source();
    if (![".srt", ".vtt"].includes(extname(path).toLowerCase()))
      throw new CoreError(
        "INVALID_INPUT",
        "Choose an SRT or WebVTT transcript.",
      );
    const fd = openRegularFile(path, 2 * 1024 * 1024);
    try {
      const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
      let size = 0;
      while (size < bytes.length) {
        const n = readSync(fd, bytes, size, bytes.length - size, null);
        if (!n) break;
        size += n;
      }
      if (size > 2 * 1024 * 1024) throw new Error("Oversized transcript");
      const cues = parseTranscript(
        new TextDecoder("utf-8", { fatal: true }).decode(
          bytes.subarray(0, size),
        ),
        source.duration,
      );
      this.save(this.workspace(), { ...this.project(), cues, suggestions: [] });
      this.notice = "Transcript imported. Review timing before exporting.";
      return this.state();
    } finally {
      closeSync(fd);
    }
  }
  saveDraft(input: unknown) {
    if (this.job)
      throw new CoreError(
        "INVALID_INPUT",
        "Cancel the current job before editing the draft.",
      );
    const value = clip.parse(input);
    if (value.end > this.source().duration)
      throw new CoreError(
        "INVALID_INPUT",
        "Clip must stay within the source video.",
      );
    this.save(this.workspace(), { ...this.project(), draft: value });
    return this.state();
  }
  private start(
    type: string,
    work: (
      id: string,
      signal: AbortSignal,
      progress: (n: number) => void,
    ) => Promise<void>,
  ) {
    if (this.job)
      throw new CoreError("INVALID_INPUT", "A Shorts job is already running.");
    const id = this.workspace();
    this.source(id);
    this.error = null;
    this.notice = null;
    const controller = new AbortController();
    const job: Job = {
      workspace: id,
      type,
      progress: 0,
      controller,
      promise: Promise.resolve(),
    };
    this.job = job;
    job.promise = work(id, controller.signal, (n) => {
      job.progress = Math.max(0, Math.min(1, n));
    })
      .catch((error) => {
        this.error = controller.signal.aborted
          ? "Job cancelled. Previous work is preserved."
          : error instanceof CoreError
            ? error.message
            : "The job could not finish. Check the provider response and media settings. Previous work is preserved.";
      })
      .finally(() => {
        if (this.job === job) this.job = null;
      });
    return this.state();
  }
  suggest() {
    return this.start("Finding clips", async (id, signal, progress) => {
      const p = this.project(id);
      if (!p.cues.length)
        throw new CoreError(
          "INVALID_INPUT",
          "Import or generate a timed transcript first.",
        );
      const suggestions = await this.ai.suggest(
        p.cues,
        p.source!.duration,
        signal,
        progress,
      );
      if (signal.aborted) return;
      this.source(id);
      this.save(id, { ...p, suggestions });
      this.notice = suggestions.length
        ? "AI suggestions are ready. Review and edit before export."
        : "The model found no suitable clips. Try another model or trim manually.";
    });
  }
  transcribe() {
    return this.start("Transcribing audio", async (id, signal, progress) => {
      const source = this.source(id);
      const parent = join(this.store.root, "shorts", "tmp");
      mkdirSync(parent, { recursive: true, mode: 0o700 });
      const temp = mkdtempSync(join(parent, "speech-"));
      const cues: z.infer<typeof cue>[] = [];
      try {
        const count = Math.ceil(source.duration / 600);
        for (let i = 0; i < count; i++) {
          if (signal.aborted) return;
          const path = join(temp, "audio.wav");
          await runFFmpeg(
            this.tool(),
            [
              "-hide_banner",
              "-loglevel",
              "error",
              "-nostdin",
              "-y",
              "-ss",
              String(i * 600),
              "-protocol_whitelist",
              "file,pipe",
              "-f",
              demuxer(source.path),
              "-i",
              source.path,
              "-t",
              String(Math.min(600, source.duration - i * 600)),
              "-vn",
              "-ac",
              "1",
              "-ar",
              "16000",
              "-c:a",
              "pcm_s16le",
              path,
            ],
            signal,
          );
          cues.push(...(await this.ai.transcribe(path, i * 600, signal)));
          if (
            cues.length > 10000 ||
            cues.reduce((n, c) => n + c.text.length, 0) > 240000
          )
            throw new CoreError(
              "INVALID_INPUT",
              "Transcript exceeds the 10,000-cue / 240,000-character limit. Use a shorter source or import edited captions.",
            );
          progress((i + 1) / count);
        }
        if (signal.aborted) return;
        this.source(id);
        const validated = validateCues(cues, source.duration);
        this.save(id, {
          ...this.project(id),
          cues: validated,
          suggestions: [],
        });
        this.notice =
          "Transcript generated. Review wording and timings before export.";
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  }
  export(input: unknown, destination: string) {
    const value = clip.parse(input);
    const source = this.source();
    if (
      value.end > source.duration ||
      resolve(destination) === resolve(source.path)
    )
      throw new CoreError(
        "INVALID_INPUT",
        "Choose a separate output file and a clip within the video.",
      );
    const captions = srt(this.project().cues, value);
    if (value.captions && !captions)
      throw new CoreError(
        "INVALID_INPUT",
        "This clip has no timed captions. Import or generate a transcript first.",
      );
    return this.start("Exporting Short", async (_id, signal) => {
      const temp = mkdtempSync(join(dirname(destination), ".creator-export-"));
      try {
        writeFileSync(join(temp, "captions.srt"), captions, { mode: 0o600 });
        const video = join(temp, "short.mp4");
        await runFFmpeg(
          this.tool(),
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-y",
            "-ss",
            String(value.start),
            "-protocol_whitelist",
            "file,pipe",
            "-f",
            demuxer(source.path),
            "-i",
            source.path,
            "-t",
            String(value.end - value.start),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-vf",
            filters(value),
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            video,
          ],
          signal,
          temp,
        );
        if (signal.aborted) return;
        if (!statSync(video).size) throw new Error("Empty output");
        this.source(_id);
        renameSync(video, destination);
        if (captions)
          renameSync(
            join(temp, "captions.srt"),
            `${destination}.${randomUUID().slice(0, 8)}.srt`,
          );
        this.notice = `Exported ${basename(destination)}${captions ? " with a uniquely named SRT sidecar" : ""}.`;
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  }
  cancel() {
    this.job?.controller.abort();
    return this.state();
  }
  async close() {
    this.job?.controller.abort();
    await this.job?.promise;
  }
  reset() {
    this.projects.clear();
    this.error = null;
    this.notice = null;
  }
  response(request: Request): Response {
    try {
      const url = new URL(request.url);
      const source = this.source();
      if (
        url.hostname !== "media" ||
        url.pathname !== `/${source.token}` ||
        url.search ||
        !["GET", "HEAD"].includes(request.method)
      )
        return new Response(null, { status: 404 });
      const size = source.size;
      let start = 0,
        end = size - 1;
      const range = request.headers.get("range");
      if (range) {
        const match = range.match(/^bytes=(\d+)-(\d*)$/);
        if (!match)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (start > end || start >= size)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
      }
      const headers: Record<string, string> = {
        "Content-Type": /\.webm$/i.test(source.path)
          ? "video/webm"
          : "video/mp4",
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "no-store",
      };
      if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      return new Response(
        request.method === "HEAD"
          ? null
          : (Readable.toWeb(
              createReadStream(source.path, { start, end }),
            ) as ReadableStream),
        { status: range ? 206 : 200, headers },
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  }
}
