import { useState } from "react";
import type { AiPurpose, AiStatus, ShortsState } from "../shared/shorts";
import type { Result } from "../shared/contracts";
export function AIProvider({
  purpose,
  status,
  disabled,
  perform,
}: {
  purpose: AiPurpose;
  status?: AiStatus;
  disabled: boolean;
  perform: (operation: () => Promise<Result<ShortsState>>) => Promise<void>;
}) {
  const [kind, setKind] = useState(
    status?.config.kind ?? (purpose === "clips" ? "ollama" : "compatible"),
  );
  const [baseURL, setURL] = useState(
    status?.config.baseURL ??
      (purpose === "clips"
        ? "http://localhost:11434"
        : "http://localhost:8080/v1"),
  );
  const [model, setModel] = useState(status?.config.model ?? "");
  const [key, setKey] = useState("");
  const [allowed, setAllowed] = useState(status?.config.allowed ?? false);
  const [context, setContext] = useState(status?.config.contextChars ?? 10000);
  const [models, setModels] = useState("");
  const [testing, setTesting] = useState(false);
  const title =
    purpose === "clips" ? "Clip suggestions" : "Speech transcription";
  return (
    <details className="ai-provider" open={!status}>
      <summary>
        {title}
        {status ? ` · ${status.config.model}` : " · Not configured"}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void perform(() =>
            window.desktop.shorts.saveAI({
              config: {
                purpose,
                kind,
                baseURL,
                model,
                allowed,
                contextChars: context,
              },
              apiKey: key,
            }),
          ).then(() => setKey(""));
        }}
      >
        <div className="studio-form-grid">
          {purpose === "clips" && (
            <label>
              Provider
              <select
                value={kind}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value as typeof kind;
                  setKind(next);
                  setURL(
                    next === "ollama"
                      ? "http://localhost:11434"
                      : "http://localhost:1234/v1",
                  );
                }}
              >
                <option value="ollama">Ollama</option>
                <option value="compatible">OpenAI-compatible</option>
              </select>
            </label>
          )}
          <label>
            Base URL
            <input
              type="url"
              required
              value={baseURL}
              disabled={disabled}
              onChange={(e) => setURL(e.target.value)}
            />
          </label>
          <label>
            Model
            <input
              required
              value={model}
              maxLength={200}
              disabled={disabled}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                purpose === "clips"
                  ? "Your installed model name"
                  : "A model supporting verbose_json timestamps"
              }
            />
          </label>
          <label>
            API key (optional)
            <input
              type="password"
              autoComplete="off"
              value={key}
              maxLength={4000}
              disabled={disabled}
              onChange={(e) => setKey(e.target.value)}
            />
            <small>
              {status?.hasKey
                ? "A key is saved. Enter it again when saving; blank removes it."
                : "Leave blank for an unauthenticated local server."}
            </small>
          </label>
          {purpose === "clips" && (
            <label>
              Transcript characters per request
              <input
                type="number"
                min={2000}
                max={24000}
                value={context}
                disabled={disabled}
                onChange={(e) => setContext(Number(e.target.value))}
              />
            </label>
          )}
        </div>
        <label className="studio-checkbox">
          <input
            type="checkbox"
            checked={allowed}
            disabled={disabled}
            onChange={(e) => setAllowed(e.target.checked)}
          />
          {purpose === "clips"
            ? "Allow this provider to read the transcript when I request clip suggestions."
            : "Allow this provider to receive extracted audio when I request transcription."}
        </label>
        <p className="field-note">
          Only the data described above is shared, when you click the
          corresponding action. This does not grant file browsing, computer
          control, or publishing access. API usage may incur provider charges.
          Ollama text models do not transcribe audio; import captions or
          configure a speech endpoint separately.
        </p>
        <div className="youtube-actions">
          <button className="button secondary" disabled={disabled}>
            Save {title.toLowerCase()} provider
          </button>
          {status && (
            <>
              <button
                type="button"
                className="button secondary"
                disabled={disabled || testing}
                onClick={() => {
                  setTesting(true);
                  void window.desktop.shorts
                    .testAI({ purpose })
                    .then((result) =>
                      setModels(
                        result.ok
                          ? `Available models: ${result.value.join(", ") || "none reported"}`
                          : result.error.message,
                      ),
                    )
                    .catch(() => setModels("Connection test failed."))
                    .finally(() => setTesting(false));
                }}
              >
                Test saved connection
              </button>
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                onClick={() =>
                  void perform(() =>
                    window.desktop.shorts.removeAI({ purpose }),
                  )
                }
              >
                Disconnect {title.toLowerCase()}
              </button>
            </>
          )}
        </div>
        {models && (
          <p role="status" className="field-note">
            {models}
          </p>
        )}
      </form>
    </details>
  );
}
