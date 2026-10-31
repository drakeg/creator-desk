import { existsSync, readFileSync, statSync } from "node:fs";
import { publisherClient } from "../../../scripts/google-client-config.mjs";
import { CoreError } from "../../shared/contracts";
export function loadAppClient(path: string) {
  if (!existsSync(path)) return null;
  try {
    if (statSync(path).size > 64000) throw new Error();
    const client = publisherClient(readFileSync(path, "utf8"));
    if (!client) throw new Error();
    return client;
  } catch {
    throw new CoreError(
      "INVALID_INPUT",
      "The built-in Google configuration is invalid. Reinstall Creator Desk using a valid build.",
    );
  }
}
