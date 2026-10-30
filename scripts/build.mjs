import { build as bundle } from "esbuild";
import { build } from "vite";
import { publisherClient } from "./google-client-config.mjs";
import { mkdir, writeFile, rm } from "node:fs/promises";
await mkdir("dist/main", { recursive: true });
const configuredClient = publisherClient(
  process.env.CREATOR_DESK_GOOGLE_DESKTOP_CLIENT_JSON,
);
const clientPath = "dist/main/google-client.json";
if (configuredClient)
  await writeFile(clientPath, JSON.stringify({ installed: configuredClient }));
else await rm(clientPath, { force: true });
await bundle({
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  target: "node22",
  sourcemap: false,
});
await bundle({
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  target: "node22",
});
await build();
await writeFile(
  "dist/build.json",
  JSON.stringify(
    {
      version: JSON.parse(
        await (
          await import("node:fs/promises")
        ).readFile("package.json", "utf8"),
      ).version,
      builtAt: new Date().toISOString(),
      architecture: process.arch,
    },
    null,
    2,
  ),
);
