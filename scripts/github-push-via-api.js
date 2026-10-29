#!/usr/bin/env node
/**
 * Push all repo files via GitHub Contents API (needs GITHUB_TOKEN with repo scope).
 * Usage: set GITHUB_TOKEN=ghp_... && node scripts/github-push-via-api.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OWNER = "vyshnavsvarma2000";
const REPO = "vss-jersey-board";
const BRANCH = process.env.GITHUB_BRANCH || "master";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("Set GITHUB_TOKEN (repo scope) for", `${OWNER}/${REPO}`);
  process.exit(1);
}

const SKIP = new Set(["node_modules", ".git"]);
const files = [];

function walk(dir, prefix = "") {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(full).isDirectory()) walk(full, rel);
    else files.push(rel.replace(/\\/g, "/"));
  }
}

walk(ROOT);

async function gh(pathSuffix, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${pathSuffix}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${pathSuffix}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  for (const file of files) {
    const full = path.join(ROOT, file);
    const content = fs.readFileSync(full).toString("base64");
    let sha;
    try {
      const existing = await gh(`/contents/${encodeURIComponent(file).replace(/%2F/g, "/")}?ref=${BRANCH}`);
      sha = existing.sha;
    } catch {
      sha = undefined;
    }
    const body = {
      message: sha ? `update ${file}` : `add ${file}`,
      content,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    };
    await gh(`/contents/${file.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log("ok", file);
  }
  console.log(`Done: https://github.com/${OWNER}/${REPO}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
