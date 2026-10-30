# Shorts Studio

Creator Desk 0.6 prioritizes turning existing long videos into Shorts. Manual editing and export are local and do not require AI. AI can transcribe audio and suggest clips, but suggestions are drafts to review before exporting.

## Local media setup

Install FFmpeg separately and choose its executable in Studio. On Apple Silicon Macs it is commonly `/opt/homebrew/bin/ffmpeg`; Windows users select `ffmpeg.exe`. Use an FFmpeg build with H.264 (`libx264`), AAC, and libass/subtitles support for burned captions. The application does not download or bundle a media-processing executable. [Official FFmpeg downloads](https://ffmpeg.org/download.html).

Choose MP4/MOV/M4V or WebM, up to six hours / 20 GB. One source draft is retained per workspace. Replacing the source resets that draft and transcript. Originals remain at their selected locations and are never modified; moving or changing a source requires selecting it again.

Trim 1–180 seconds. Fill crops to a vertical frame with a horizontal focus control; Fit preserves the entire picture with black padding. Preview uses the source codec and framing; unsupported playback codecs may still export through FFmpeg. Export produces 720×1280, 30 fps H.264/AAC MP4. Optional burned captions require subtitle support; timed captions also produce a uniquely named SRT sidecar so an existing adjacent subtitle file is never silently overwritten. Review exported captions before publishing.

## Choose AI and grant access

In Studio → Choose your AI and its access:

- **Clip suggestions:** choose Ollama or an OpenAI-compatible chat service, enter its base URL and installed/available model name, and optionally an API key. Ollama defaults to `http://localhost:11434`; compatible service base URLs generally include `/v1`. No model is selected or downloaded automatically.
- **Speech transcription:** choose an OpenAI-compatible transcription endpoint and a model supporting `verbose_json` with timed segments. Where supported, `whisper-1` is an example; a text-only chat model cannot perform this step. Local speech servers must expose the compatible `/audio/transcriptions` API. This can be independent of the model used for clip suggestions.
- Grant transcript or audio access separately. Saving/testing a connection does not upload a transcript or audio. Test saved connection lists models; enter an exact model name. A server without a models-list endpoint may still support transcription.
- Enter a key whenever saving a provider that needs authentication. A blank key explicitly removes the prior key. Keys use OS protected storage, never return to the renderer, and are excluded from backups. Linux needs an unlocked system keyring when saving a key; unauthenticated local services do not need one.
- Credentials are bound to the exact saved endpoint. Restoring configuration for a different endpoint cannot silently send an old key there. HTTPS is required except for HTTP on localhost/loopback.

**Transcribe audio with selected AI** extracts mono 16 kHz WAV locally in chunks up to ten minutes (under 24 MB each) and sends those chunks only to the configured speech destination. The source video itself is not uploaded. Audio processing and provider usage can take time or incur charges. Cancel stops further work and preserves the previous transcript.

Alternatively, import UTF-8 SRT or WebVTT captions and use Ollama for a fully local transcript-to-clips workflow. Ollama chat models do not automatically gain access to your video or microphone. Timed transcripts are limited to 10,000 cues / 240,000 text characters.

**Suggest clips with selected AI** sends transcript batches to the configured clip model. Adjust characters per request for the model's context capacity (2,000–24,000, default 10,000). Large transcripts may require multiple requests. A model's context/token limits can still require smaller batches. The model selects cue IDs; the app validates IDs, duration, and source bounds. It has no tools, file browsing, shell access, or publishing permissions. AI scores are subjective ranking hints and are not shown as performance predictions. Up to eight suggestions are offered; choose one, edit its timing/framing, and export explicitly.

## Storage and recovery

Shorts drafts/transcripts live under the local data directory's `shorts` folder. Source media stays where you selected it. Current database backups **exclude Shorts drafts, transcripts, and source media**; preserve source/exported files separately. Restoring the database does not replace those media drafts. Non-secret provider settings are in the database; AI keys are excluded. Only one media/AI job runs at a time, and providers cannot be reconfigured while a job is active.

Failures preserve the prior draft/transcript and completed exports. Export writes a temporary file before replacing the destination explicitly chosen in the save dialog. No automatic upload/publishing is performed.

## Verification

Unit checks cover timing, clip bounds, provider permissions, key protection/endpoint binding, fabricated AI cue IDs, local-media range access, workspace isolation, and cancellation. The installed-app test generates an actual video, extracts audio, uses controlled speech/chat responses, renders burned captions, verifies 720×1280 output/duration, confirms the original hash is unchanged, and reopens the saved draft. Controlled responses prove integration and validation, not real model quality or availability.

A checksum-verified FFmpeg download under `.cache/tools` is used only for synthetic tests; it is excluded from packaged applications. Real users select their own installed media tool and AI services. Real provider/model setup and quality should be checked with representative user content.

## API references

- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)
- [Ollama chat API](https://docs.ollama.com/api/chat)
- [Compatible transcription format](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
- [Compatible JSON chat output](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat)
