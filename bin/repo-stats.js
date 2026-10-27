#!/usr/bin/env node
/**
 * Fetch the /repositories/ page's repo facts from the GitHub API at build time.
 *
 * Reads the curated `github_repos` list from _data/repositories.yml, preserving
 * its order, fetches each repo from api.github.com, and writes
 * _data/repository_stats.json for the page to render as native HTML. The page
 * no longer depends on a third-party image service at load time (epic #54).
 * Curation stays hand-edited: this script never changes repositories.yml.
 *
 *   node bin/repo-stats.js
 *
 * Options:
 *   --input <path>   curated list   (default: _data/repositories.yml)
 *   --out <path>     output file    (default: _data/repository_stats.json)
 *   --no-auth        ignore every token source and run unauthenticated
 *   --help           print this usage
 *
 * Adding a repo to the page: add its `owner/name` to `github_repos` in
 * _data/repositories.yml, at the position it should appear, then run this
 * script and commit both files. Removing one is the same edit in reverse.
 *
 * Auth and rate limits. One pass is one request per curated repo (~12), plus
 * one to raw.githubusercontent.com, which is not API quota. That fits the
 * 60/hr unauthenticated limit, so no PAT is needed for local use. A token
 * is used when one is available, taken from the first of: GITHUB_TOKEN (set
 * in Actions, 5,000/hr), GH_TOKEN, or `gh auth token` if the gh CLI is
 * installed and logged in. A logged-in gh supplies a token silently, so pass
 * --no-auth to exercise the unauthenticated path. The script logs which
 * source it used, and never logs the token.
 *
 * Output. Repos are keyed by the exact string from repositories.yml, never by
 * the API's `full_name`: Ruby hash keys are case-sensitive and GitHub names are
 * not, so a casing mismatch would be a silent blank card. Look a repo up as
 * `site.data.repository_stats.repos[repo]`. Language colors come from
 * linguist's languages.yml (the REST API returns the language name, not its
 * color). They are keyed by language name in `language_colors`, so a display
 * override can pick the color of the language it shows. The output is JSON
 * rather than YAML because a raw control or line-separator character in a
 * description can make Ruby's YAML parser reject the file, which would fail the
 * whole site build.
 *
 * Failure policy. Everything is validated before anything is written, so a
 * failed run leaves the existing file untouched. A run whose data matches the
 * existing file, ignoring `generated_at`, also leaves it untouched, so
 * `generated_at` means "data last changed at". A curated repo that returns 404
 * or is not public fails the run: a dead repo on a portfolio page is a
 * curation problem, and a human must remove it from repositories.yml. A
 * transient failure (5xx, network, rate limit) also fails the run, with its
 * own exit code. That tells a scheduled job to retry rather than ask a human
 * to edit the curation.
 *
 * Exit codes: 0 written or unchanged; 1 permanent failure (404, not public,
 * token rejected, validation); 75 transient failures only; 2 usage error.
 *
 * REPO_STATS_API_BASE overrides https://api.github.com. It exists only to
 * exercise the transient path against an unreachable host.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const API_BASE = process.env.REPO_STATS_API_BASE || "https://api.github.com";
// Pinned so colors only change when this constant does.
const LINGUIST_TAG = "v9.7.0";
const LINGUIST_URL = `https://raw.githubusercontent.com/github-linguist/linguist/${LINGUIST_TAG}/lib/linguist/languages.yml`;
const ATTEMPTS = 3;
const EXIT_PERMANENT = 1;
const EXIT_USAGE = 2;
const EXIT_TRANSIENT = 75;

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

class UsageError extends Error {}

// A failure attributable to one subject (a repo, or linguist), classified so
// the exit code can tell a human-must-act failure from a retry-later one.
class Failure extends Error {
  constructor(subject, transient, message) {
    super(message);
    this.subject = subject;
    this.transient = transient;
  }
}

function parseArgs(argv) {
  const opts = { input: "_data/repositories.yml", out: "_data/repository_stats.json", noAuth: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--no-auth") opts.noAuth = true;
    else if (flag === "--help") opts.help = true;
    else if (flag === "--input" || flag === "--out") {
      const value = argv[++i];
      if (!value) throw new UsageError(`${flag} needs a value`);
      opts[flag.slice(2)] = value;
    } else throw new UsageError(`unknown option: ${flag}`);
  }
  return opts;
}

// A strict reader for the one list this script needs, so it carries no YAML
// dependency. It fails on anything it does not understand rather than
// guessing, because a silently dropped line is a repo silently missing from the
// page.
function readCurated(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => /^github_repos:\s*(#.*)?$/.test(l));
  if (start < 0) throw new Failure(file, false, "no top-level `github_repos:` key");

  const repos = [];
  const seen = new Map();
  for (let n = start + 1; n < lines.length; n++) {
    const line = lines[n];
    // The block ends at the next top-level key; a column-0 comment or item
    // does not end it.
    if (/^[^\s#-]/.test(line)) break;
    const text = line.trim();
    if (text === "" || text.startsWith("#")) continue;
    const m = /^-\s+(["']?)([^"'#\s]+)\1\s*(#.*)?$/.exec(text);
    if (!m) throw new Failure(file, false, `line ${n + 1}: not a list item: ${text}`);
    const repo = m[2];
    if (!REPO_PATTERN.test(repo)) throw new Failure(file, false, `line ${n + 1}: not an owner/name: ${repo}`);
    const folded = repo.toLowerCase();
    if (seen.has(folded)) throw new Failure(file, false, `line ${n + 1}: ${repo} duplicates line ${seen.get(folded)}`);
    seen.set(folded, n + 1);
    repos.push(repo);
  }
  if (repos.length === 0) throw new Failure(file, false, "`github_repos` lists no repos");
  return repos;
}

function resolveAuth(noAuth) {
  if (noAuth) return { token: null, source: "none (--no-auth)" };
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, source: "GITHUB_TOKEN" };
  if (process.env.GH_TOKEN) return { token: process.env.GH_TOKEN, source: "GH_TOKEN" };
  try {
    const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (token) return { token, source: "gh auth token" };
  } catch {
    // gh missing or logged out: fall through to unauthenticated.
  }
  return { token: null, source: "none (no token found)" };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GET with in-run retries for the failures that are worth retrying at once:
// network errors and 5xx. Every other response is returned for the caller to
// classify.
async function get(subject, url, headers) {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow" });
      if (res.status < 500) return res;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = `network error: ${err.cause?.code || err.cause?.message || err.message}`;
    }
    if (attempt < ATTEMPTS) await sleep(1000 * attempt);
  }
  throw new Failure(subject, true, `transient: ${last} after ${ATTEMPTS} attempts; retry later`);
}

async function fetchLanguageColors() {
  const res = await get("linguist", LINGUIST_URL, { "User-Agent": "repo-stats" });
  if (!res.ok) throw new Failure("linguist", false, `${LINGUIST_URL} returned HTTP ${res.status}`);
  const colors = new Map();
  let current = null;
  let count = 0;
  for (const line of (await res.text()).split("\n")) {
    const key = /^([^\s#-][^:]*):\s*$/.exec(line);
    if (key) {
      current = key[1];
      count++;
      continue;
    }
    // Only a 2-space-indented color directly under the current language.
    const color = /^ {2}color: "(#[0-9a-fA-F]{6})"\s*$/.exec(line);
    if (current && color) colors.set(current, color[1]);
  }
  // linguist lists 800+ languages; far fewer means the file's format changed
  // under this scan, not that the languages went away.
  if (count < 300 || colors.size < 300) {
    throw new Failure("linguist", false, `parsed only ${count} languages and ${colors.size} colors from ${LINGUIST_TAG}; has the format changed?`);
  }
  return colors;
}

function classifyRateLimit(repo, res, body) {
  if (res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const at = reset ? new Date(reset * 1000).toISOString() : "the next hour";
    return new Failure(repo, true, `transient: API rate limit exhausted (resets ${at}); retry later`);
  }
  if (res.headers.get("retry-after") || /secondary rate limit/i.test(body)) {
    return new Failure(repo, true, "transient: secondary rate limit; retry later");
  }
  return null;
}

async function fetchRepo(repo, headers, authSource) {
  const res = await get(repo, `${API_BASE}/repos/${repo}`, headers);
  if (res.status === 404) {
    return new Failure(repo, false, "returned 404 (deleted, made private, or the name reused). A human must remove it from _data/repositories.yml");
  }
  if (res.status === 401) return new Failure(repo, false, `token rejected (HTTP 401); the token came from ${authSource}`);
  if (res.status === 403 || res.status === 429) {
    const limited = classifyRateLimit(repo, res, await res.text());
    if (limited) return limited;
  }
  if (!res.ok) return new Failure(repo, false, `returned HTTP ${res.status}`);
  return res.json();
}

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
const count = (v) => Number.isInteger(v) && v >= 0;

// Validate one API response and project it to the fields the page uses, in a
// fixed order. `colors` is null when linguist itself failed, in which case
// color checks are skipped rather than reported as a missing language.
function shapeRepo(repo, d, colors) {
  const problems = [];
  if (d.private === true || d.visibility !== "public") {
    return { problems: ["is not public. A human must remove it from _data/repositories.yml"] };
  }
  const color = colors && nonEmpty(d.language) ? colors.get(d.language) : undefined;
  if (!nonEmpty(d.full_name)) problems.push("missing full_name");
  if (!nonEmpty(d.owner?.login)) problems.push("missing owner");
  if (!nonEmpty(d.description)) problems.push("has no description; add one on GitHub");
  if (!nonEmpty(d.language)) problems.push("has no detected language");
  else if (colors && !(color && COLOR_PATTERN.test(color))) problems.push(`language "${d.language}" has no color in linguist ${LINGUIST_TAG}`);
  if (!count(d.stargazers_count)) problems.push("missing stargazers_count");
  if (!count(d.forks_count)) problems.push("missing forks_count");
  const homepage = nonEmpty(d.homepage) ? d.homepage.trim() : null;
  if (homepage !== null && !/^https?:\/\/\S+$/i.test(homepage)) problems.push(`homepage is not an http(s) URL: ${homepage}`);
  if (problems.length) return { problems };

  return {
    problems,
    entry: {
      full_name: d.full_name,
      owner: d.owner.login,
      description: d.description,
      language: d.language,
      language_color: color ?? null,
      stargazers_count: d.stargazers_count,
      forks_count: d.forks_count,
      pushed_at: d.pushed_at ?? null,
      topics: Array.isArray(d.topics) ? [...d.topics].sort() : [],
      homepage,
      archived: d.archived === true,
    },
  };
}

// Compare everything but `generated_at`, so an unchanged run writes nothing.
function sameData(file, next) {
  let prev;
  try {
    prev = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  const strip = ({ generated_at, ...rest }) => JSON.stringify(rest);
  return strip(prev) === strip(next);
}

function writeAtomically(file, text) {
  // A dotfile with a non-data extension, so Jekyll never reads a partial one.
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log("usage: node bin/repo-stats.js [--input <path>] [--out <path>] [--no-auth]");
    return 0;
  }

  const repos = readCurated(opts.input);
  const auth = resolveAuth(opts.noAuth);
  console.log(`${repos.length} curated repos; auth: ${auth.source}`);

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repo-stats",
  };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const failures = [];
  let colors = null;
  try {
    colors = await fetchLanguageColors();
  } catch (err) {
    if (!(err instanceof Failure)) throw err;
    failures.push(err);
  }

  const entries = {};
  for (const repo of repos) {
    let data;
    try {
      data = await fetchRepo(repo, headers, auth.source);
    } catch (err) {
      if (!(err instanceof Failure)) throw err;
      data = err;
    }
    if (data instanceof Failure) {
      failures.push(data);
      continue;
    }
    const { problems, entry } = shapeRepo(repo, data, colors);
    if (problems.length) {
      failures.push(new Failure(repo, false, problems.join("; ")));
      continue;
    }
    if (entry.full_name !== repo) {
      const kind = entry.full_name.toLowerCase() === repo.toLowerCase() ? "differs only in case from" : "was renamed or transferred to";
      console.error(`warning: ${repo} ${kind} ${entry.full_name}; update _data/repositories.yml`);
    }
    entries[repo] = entry;
  }

  if (failures.length) {
    for (const f of failures) console.error(`error: ${f.subject}: ${f.message}`);
    const transientOnly = failures.every((f) => f.transient);
    console.error(`${opts.out} left unchanged (${transientOnly ? "transient" : "permanent"} failure).`);
    return transientOnly ? EXIT_TRANSIENT : EXIT_PERMANENT;
  }

  const languages = [...new Set(Object.values(entries).map((e) => e.language))].sort();
  const output = {
    _generated_by: "bin/repo-stats.js — do not edit by hand",
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    language_colors: Object.fromEntries(languages.map((l) => [l, colors.get(l)])),
    repos: entries,
  };

  if (sameData(opts.out, output)) {
    console.log(`${opts.out} unchanged.`);
    return 0;
  }
  writeAtomically(opts.out, JSON.stringify(output, null, 2) + "\n");
  console.log(`wrote ${opts.out} (${repos.length} repos, ${languages.length} languages).`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    if (err instanceof UsageError) {
      console.error(`usage error: ${err.message}`);
      process.exitCode = EXIT_USAGE;
    } else if (err instanceof Failure) {
      console.error(`error: ${err.subject}: ${err.message}`);
      process.exitCode = err.transient ? EXIT_TRANSIENT : EXIT_PERMANENT;
    } else {
      console.error(`unexpected error: ${err.stack || err}`);
      process.exitCode = EXIT_PERMANENT;
    }
  }
);
