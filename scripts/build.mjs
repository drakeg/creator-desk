import { build as bundle } from "esbuild";
import { build } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("dist/main", { recursive: true });
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
