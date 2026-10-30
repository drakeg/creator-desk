import { z } from "zod";
export const cue = z
  .object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    text: z.string().trim().min(1).max(2000),
  })
  .strict()
  .refine((v) => v.end > v.start);
export type Cue = z.infer<typeof cue>;
export const clip = z
  .object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    title: z.string().trim().min(1).max(100),
    reason: z.string().max(500).default(""),
    focus: z.number().min(0).max(1).default(0.5),
    fit: z.enum(["crop", "fit"]).default("crop"),
    captions: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => v.end > v.start && v.end - v.start <= 180,
    "Choose a clip lasting 1–180 seconds.",
  )
  .refine((v) => v.end - v.start >= 1, "Choose at least one second.");
export type Clip = z.infer<typeof clip>;
export const aiPurpose = z.enum(["clips", "speech"]);
export type AiPurpose = z.infer<typeof aiPurpose>;
export const endpoint = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        (u.protocol === "https:" ||
          (u.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
      );
    } catch {
      return false;
    }
  }, "Use HTTPS, or HTTP on localhost for a local server.");
export const aiConfig = z
  .object({
    purpose: aiPurpose,
    kind: z.enum(["ollama", "compatible"]),
    baseURL: endpoint,
    model: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[^\r\n]+$/),
    allowed: z.boolean(),
    contextChars: z.number().int().min(2000).max(24000).default(10000),
  })
  .strict()
  .refine(
    (v) => v.purpose !== "speech" || v.kind === "compatible",
    "Speech requires a compatible transcription endpoint.",
  );
export type AiConfig = z.infer<typeof aiConfig>;
export const saveAiInput = z
  .object({ config: aiConfig, apiKey: z.string().max(4000) })
  .strict();
export interface AiStatus {
  config: AiConfig;
  hasKey: boolean;
}
export interface ShortsState {
  source: { name: string; duration: number; url: string } | null;
  cues: Cue[];
  suggestions: Clip[];
  draft: Clip | null;
  job: { type: string; progress: number } | null;
  error: string | null;
  notice: string | null;
  ffmpegReady: boolean;
  providers: Partial<Record<AiPurpose, AiStatus>>;
}
export interface ShortsAPI {
  get(): Promise<import("./contracts").Result<ShortsState>>;
  chooseVideo(): Promise<import("./contracts").Result<ShortsState>>;
  chooseFFmpeg(): Promise<import("./contracts").Result<ShortsState>>;
  importTranscript(): Promise<import("./contracts").Result<ShortsState>>;
  saveAI(
    input: z.input<typeof saveAiInput>,
  ): Promise<import("./contracts").Result<ShortsState>>;
  removeAI(input: {
    purpose: AiPurpose;
  }): Promise<import("./contracts").Result<ShortsState>>;
  testAI(input: {
    purpose: AiPurpose;
  }): Promise<import("./contracts").Result<string[]>>;
  transcribe(): Promise<import("./contracts").Result<ShortsState>>;
  suggest(): Promise<import("./contracts").Result<ShortsState>>;
  saveDraft(input: Clip): Promise<import("./contracts").Result<ShortsState>>;
  exportClip(input: Clip): Promise<import("./contracts").Result<ShortsState>>;
  cancel(): Promise<import("./contracts").Result<ShortsState>>;
}
