import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function releaseStatus(response) {
  if (response.status === 404) return "new";
  if (!response.ok)
    throw new Error(`GitHub release lookup failed (HTTP ${response.status})`);
  const release = await response.json();
  if (!release || typeof release.draft !== "boolean")
    throw new Error("Invalid GitHub release response");
  return release.draft ? "draft" : "published";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  const output = process.env.GITHUB_OUTPUT;
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !token ||
    !output
  )
    throw new Error("Missing or invalid release workflow configuration");
  const response = await globalThis.fetch(
    `https://api.github.com/repos/${repository}/releases/tags/v${version}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: globalThis.AbortSignal.timeout(30_000),
      redirect: "error",
    },
  );
  const status = await releaseStatus(response);
  appendFileSync(output, `publish=${status !== "published"}\n`);
  console.log(
    status === "published"
      ? `v${version} is already published; preserving its tag and downloads. Bump the version to publish new installers.`
      : `v${version}: ${status === "draft" ? "resume draft" : "create release"}.`,
  );
}
