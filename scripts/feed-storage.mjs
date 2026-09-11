import { mkdir, readFile, writeFile } from "node:fs/promises";
// Only normalized public job facts are stored, never browser profile or actions.
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
if (!repository || !token)
  throw new Error("Run feed storage inside the GitHub workflow.");
const base = `https://api.github.com/repos/${repository}`;
const branch = "radar-data";
async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`GitHub feed storage returned HTTP ${response.status}`);
  return response.json();
}
const file = "/contents/public/data/jobs.json";
if (process.argv[2] === "read") {
  const stored = await api(`${file}?ref=${branch}`);
  if (stored) {
    let content;
    if (stored.encoding === "base64" && stored.content)
      content = Buffer.from(stored.content, "base64");
    else {
      // GitHub omits base64 content for files above 1 MB; use the raw media type.
      const response = await fetch(`${base}${file}?ref=${branch}`, {
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.raw+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!response.ok)
        throw new Error(`GitHub raw feed returned HTTP ${response.status}`);
      content = Buffer.from(await response.arrayBuffer());
    }
    await mkdir("public/data", { recursive: true });
    await writeFile("public/data/jobs.json", content);
  }
} else if (process.argv[2] === "write") {
  if (!(await api(`/git/ref/heads/${branch}`))) {
    const created = await api("/git/refs", {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: process.env.GITHUB_SHA,
      }),
    });
    if (!created) throw new Error("Could not create public data branch");
  }
  const old = await api(`${file}?ref=${branch}`);
  const content = await readFile("public/data/jobs.json");
  const feed = JSON.parse(content.toString());
  if (
    feed.version !== 1 ||
    !Array.isArray(feed.jobs) ||
    "profile" in feed ||
    "applications" in feed ||
    "history" in feed
  )
    throw new Error("Only a public jobs feed can be published");
  const saved = await api(file, {
    method: "PUT",
    body: JSON.stringify({
      message: "Refresh public job listings",
      branch,
      content: content.toString("base64"),
      ...(old?.sha ? { sha: old.sha } : {}),
    }),
  });
  if (!saved) throw new Error("Could not save public job feed");
} else throw new Error("Use read or write");
