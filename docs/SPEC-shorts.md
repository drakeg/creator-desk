# Shorts Studio — 0.6

Prioritize repurposing user-selected local long videos into vertical Shorts. Manual trim/reframe/export works without AI. Preview source video, select 1–180 seconds, choose crop/focus or fit, and export H.264/AAC 720×1280 MP4 with optional burned captions and an SRT sidecar. The original is never modified. FFmpeg is a user-selected installed executable; no executable path is accepted from the renderer.

Import timed SRT/VTT captions or explicitly transcribe audio with a user-selected compatible speech endpoint. Analyze the transcript with user-selected Ollama or OpenAI-compatible chat models. No model is forced, downloaded, or given general computer access. Each AI connection has an explicit data permission, visible destination, model, protected optional API key, test action, and disconnect. Audio and transcript permissions are separate. Imported transcripts allow a fully local workflow with Ollama.

AI suggestions reference validated cue IDs, stay inside the video, and last at most 180 seconds. Suggestions are drafts; users review and edit before exporting. No automatic publishing. All network and media processes are bounded, cancellable, and run in the main process. No shell commands or arbitrary filesystem paths cross IPC. Only selected media is served to the renderer with a scoped opaque URL.

Maintain one recoverable local draft per workspace; source videos remain in their original location. Shorts drafts and media are excluded from current database backups, disclosed in the UI. AI keys are excluded from backups. Failed operations preserve the prior transcript and completed exports. Exports use temporary files before replacing the explicitly selected destination.

Verify subtitle timing/validation, invalid AI selections, provider permissions and endpoint binding, cancellation, actual FFmpeg outputs, and the installed desktop workflow on macOS, Windows, and Linux. Real user-selected model/endpoint availability remains configuration-dependent.
