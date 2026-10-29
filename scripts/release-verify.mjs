import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { releaseTarget } from "./release-policy.mjs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const target = releaseTarget(process.platform, process.arch, version);
const destination = join("release", target.label);
mkdirSync(destination, { recursive: true });
const checksums = target.assets.map((name) => {
  const source = join("out/make", name);
  if (statSync(source).size < 1000000)
    throw new Error(`Invalid package size: ${name}`);
  const digest = createHash("sha256")
    .update(readFileSync(source))
    .digest("hex");
  copyFileSync(source, join(destination, name));
  return `${digest}  ${name}`;
});
writeFileSync(
  join(destination, `${target.label}-SHA256SUMS.txt`),
  checksums.join("\n") + "\n",
);
