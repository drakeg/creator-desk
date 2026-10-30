import { dialog, type BrowserWindow } from "electron";
import { z } from "zod";
import { clip, saveAiInput, aiPurpose } from "../../shared/shorts";
import { CoreError } from "../../shared/contracts";
import { Shorts } from "./service";
type Register = (
  name: string,
  schema: z.ZodType,
  operation: (input: unknown) => unknown,
) => void;
export function registerShorts(
  handle: Register,
  shorts: Shorts,
  window: () => BrowserWindow,
) {
  const choose = async (title: string, extensions: string[]) => {
    const result = await dialog.showOpenDialog(window(), {
      title,
      properties: ["openFile"],
      ...(extensions.length ? { filters: [{ name: title, extensions }] } : {}),
    });
    return result.canceled ? null : result.filePaths[0] || null;
  };
  const purpose = z.object({ purpose: aiPurpose }).strict();
  handle("shortsGet", z.undefined(), () => shorts.state());
  handle("shortsChooseFFmpeg", z.undefined(), async () => {
    const path = await choose(
      "Choose installed FFmpeg executable",
      process.platform === "win32" ? ["exe"] : [],
    );
    return path ? shorts.chooseTool(path) : shorts.state();
  });
  handle("shortsChooseVideo", z.undefined(), async () => {
    const path = await choose(
      "Choose source video (replaces current Shorts draft)",
      ["mp4", "mov", "m4v", "webm"],
    );
    return path ? shorts.chooseVideo(path) : shorts.state();
  });
  handle("shortsImportTranscript", z.undefined(), async () => {
    const path = await choose("Choose timed transcript", ["srt", "vtt"]);
    return path ? shorts.importTranscript(path) : shorts.state();
  });
  handle("shortsSaveAI", saveAiInput, (input) => {
    if (shorts.state().job)
      throw new CoreError(
        "INVALID_INPUT",
        "Cancel the running job before changing AI access.",
      );
    shorts.ai.save(input);
    return shorts.state();
  });
  handle("shortsRemoveAI", purpose, (input) => {
    if (shorts.state().job)
      throw new CoreError(
        "INVALID_INPUT",
        "Cancel the running job before disconnecting AI.",
      );
    shorts.ai.remove(purpose.parse(input).purpose);
    return shorts.state();
  });
  handle("shortsTestAI", purpose, (input) =>
    shorts.ai.test(purpose.parse(input).purpose),
  );
  handle("shortsTranscribe", z.undefined(), () => shorts.transcribe());
  handle("shortsSuggest", z.undefined(), () => shorts.suggest());
  handle("shortsSaveDraft", clip, (input) => shorts.saveDraft(input));
  handle("shortsCancel", z.undefined(), () => shorts.cancel());
  handle("shortsExport", clip, async (input) => {
    const value = clip.parse(input);
    const name =
      Array.from(value.title)
        .filter((c) => c.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(c))
        .join("")
        .replace(/^\.+/, "")
        .slice(0, 80) || "Short";
    const result = await dialog.showSaveDialog(window(), {
      title: "Export vertical MP4 and optional SRT captions",
      defaultPath: `${name}.mp4`,
      filters: [{ name: "MP4 video", extensions: ["mp4"] }],
    });
    if (result.canceled || !result.filePath) return shorts.state();
    if (!result.filePath.toLowerCase().endsWith(".mp4"))
      throw new CoreError("INVALID_INPUT", "Use an .mp4 filename.");
    return shorts.export(value, result.filePath);
  });
}
