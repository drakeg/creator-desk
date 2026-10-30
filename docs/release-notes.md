Creator Desk 0.6 adds Shorts Studio for repurposing existing long videos.

- Trim and preview clips, adjust vertical crop/focus or fit, and export 720×1280 H.264/AAC MP4 locally using your selected installed FFmpeg executable.
- Import timed SRT/VTT captions or transcribe audio with a separately configured compatible speech model. Burn captions and export an SRT sidecar.
- Choose Ollama or an OpenAI-compatible chat model to suggest clips from the transcript. Audio and transcript access are separate permissions; AI has no general computer or publishing access.
- Review/edit every suggestion before exporting. Keys use OS protected storage. Jobs can be cancelled, and drafts persist per workspace.

Setup: install/select FFmpeg in Studio, and optionally configure your own AI endpoints/models. No model or media executable is bundled. Shorts drafts, transcripts, and source videos are outside current database backups; preserve those files separately. See docs/SHORTS.md for limits and provider compatibility.

Downloads cover Apple Silicon/Intel macOS, Windows x64, and Debian/Ubuntu Linux x64. macOS builds are ad hoc signed and not notarized; Windows builds are unsigned. Checksums are included.
