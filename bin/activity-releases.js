#!/usr/bin/env node
/**
 * Fetch the GitHub Releases that the Activity stream shows (#75) into a
 * committed data file.
 *
 * Fetches every release of each repo in RELEASE_REPOS from api.github.com,
 * keeps the published, minor-or-greater ones, derives a one-line summary from
 * each release body, and writes _data/activity.json. It runs daily from
 * .github/workflows/activity-releases.yml (through
 * bin/activity-releases-refresh.sh) and by hand, never inside the Jekyll build,
 * so a GitHub API failure cannot fail a deploy (#54, #73). The stream's Release
 * branch (_includes/activity.liquid, #75) reads only this local file.
 *
 *   node bin/activity-releases.js
 *
 * Options:
 *   --out <path>     output file    (default: _data/activity.json)
 *   --no-auth        ignore every token source and run unauthenticated
 *   --help           print the usage and options
 *
 * Adding a repo: add its `owner/name` to RELEASE_REPOS below, then run this
 * script and commit both files. Removing one is the same edit in reverse, but
 * the refresh workflow's guardrail fails any run that drops a release the
 * committed file has, so a removal must be committed from a local run: run this
 * script and commit both files. The same goes for a release deleted or turned
 * into a pre-release upstream: confirm it on GitHub, then run this script
 * locally and commit the result. One exception: when EVERY release of a repo
 * is gone, a local run fails too (an empty list is refused for a repo the file
 * has releases for), so remove the repo from RELEASE_REPOS, run this script
 * and commit both files. Never edit _data/activity.json by hand: a summary
 * that needs rewording gets an entry in _data/release_summaries.yml (#74).
 *
 * Output: `{ _generated_by, generated_at, releases: [...] }`, newest first
 * (then by repo, then by tag), each release `{ repo, tag, date, summary, url }`.
 * `repo` is the short name (`agentfluent`), so `repo@tag` is the key the
 * render-time override file, _data/release_summaries.yml (#74), uses. `date`
 * is the release's published_at as an ISO 8601 UTC string, not a Ruby Time, so
 * convert it before sorting it against posts or notes.
 * `url` is the release page on github.com.
 *
 * `summary` is PLAIN TEXT derived from text anyone who opens a PR upstream can
 * influence (release-please builds release notes from commit and PR titles).
 * Render it with `| escape`, never `markdownify`. This script also strips
 * angle brackets, control, line-separator and bidi characters, and caps it at
 * SUMMARY_MAX characters (cut at a code point, never inside one). The refresh
 * guardrail rejects the same characters but does not check the length, and
 * escaping at render time is the contract either way. It is null when nothing
 * usable was found, and the stream's Release branch then shows the tag alone.
 *
 * Which releases. Drafts and pre-releases are skipped, as are patches
 * (vX.Y.Z with Z > 0): only minor-or-greater releases (vX.Y.0, `v` optional)
 * are written. A published release whose tag is neither fails the run rather
 * than being skipped, so a new tag format can't drop a release while the run
 * stays green; extend the patterns below for it.
 *
 * The summary is chosen by the shape of each body, never by repo, because
 * formats vary per release (codefluent v1.1.0 is release-please, v1.2.0 is
 * GitHub's generated notes):
 *   - release-please (a `### Features` heading): the first bullet under it.
 *   - GitHub's generated notes (`## What's Changed`): the first `feat:` bullet
 *     in that section, else the first bullet.
 *   - anything else: the first `feat` bullet in the body, else the first
 *     bullet.
 * Dependabot bullets (anything mentioning @dependabot, `chore(deps`,
 * `build(deps`, `Bump `) and "@user made their first contribution" lines are
 * never candidates. When a body has a recognized section but nothing usable is
 * left in it, the summary is null; it never falls through to the rest of the
 * body (which would reach `## New Contributors`).
 * Headings are never candidates. Each candidate is cleaned: the author and PR
 * link, link markup, bold, backticks and the `feat:` prefix (`feat(x): y`
 * becomes `x: y`) go, and so does EVERY trailing parenthetical group, not just
 * link noise: `analyze: show an SDK-vs-Claude-Code indicator (CLI badge +
 * JSON) (#592)` becomes `analyze: show an SDK-vs-Claude-Code indicator`. That
 * was a deliberate choice on #73 (the issue's verified output); where it loses
 * meaning, an entry in _data/release_summaries.yml (#74) is the fix.
 *
 * Failure policy: fail closed. Everything is fetched and validated before
 * anything is written, and if any repo fails, nothing is written, so one repo
 * down can never shorten the file (#73). An empty release list is a failure
 * when the current file already has releases for that repo (an API hiccup
 * must not blank it), and accepted otherwise, so a repo with no releases yet
 * (claude-code-loop before v0.6.0) and a first run with no file both work. A
 * current file that exists but cannot be read, or is not this script's shape,
 * fails the run rather than reading as a first run. A run whose data matches
 * the current file, ignoring `generated_at`, writes nothing.
 *
 * Exit codes and stderr follow bin/repo-stats.js, because
 * bin/activity-releases-refresh.sh reads them the same way: 0 written or
 * unchanged; 1 permanent failure; 75 transient failures only; 2 usage error.
 * Every `error:` line is followed by an `  action:` line; a crash prints
 * `unexpected error:` and its stack. stdout carries counts and paths only,
 * never API text: the refresh script replays stderr with workflow commands
 * stopped, but not stdout.
 *
 * Auth: one request per repo per 100 releases, well inside the 60/hr
 * unauthenticated limit. A token is used when available, from GITHUB_TOKEN,
 * GH_TOKEN, or `gh auth token`; pass --no-auth to skip it. A pagination link is
 * followed only when it is on the API base's own origin, so the script never
 * sends the token anywhere else itself. HTTP redirects are followed by fetch
 * (`redirect: "follow"`, as in bin/repo-stats.js, which needs it for renamed
 * repos), and those are not checked here: on a cross-origin redirect it is
 * Node's fetch (undici, per the Fetch spec) that drops the Authorization
 * header. Hardening both twins' redirect handling together is #165.
 *
 * ACTIVITY_API_BASE overrides https://api.github.com. It exists only to
 * exercise failure paths against a local stub, and a run with it set is always
 * unauthenticated.
 *
 * Several helpers are copies of their twins in bin/repo-stats.js, adapted to
 * this script. Extracting them into a shared module, with tests, is #165.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// One place to add a repo. The guardrail in bin/activity-releases-refresh.sh
// fails a run that drops one, so remove a repo with a local run (see above).
const RELEASE_REPOS = ["frederick-douglas-pearce/codefluent", "frederick-douglas-pearce/agentfluent", "frederick-douglas-pearce/claude-code-loop"];

const API_OVERRIDDEN = Boolean(process.env.ACTIVITY_API_BASE);
const API_BASE = API_OVERRIDDEN ? process.env.ACTIVITY_API_BASE : "https://api.github.com";
// 100 releases a page. activity-releases.yml's timeout-minutes is derived from
// RELEASE_REPOS.length x PAGE_CAP requests, each bounded by ATTEMPTS x
// REQUEST_TIMEOUT_MS plus get()'s backoff; recompute it if any of those change.
const PER_PAGE = 100;
const PAGE_CAP = 3;
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15000;
const GH_TIMEOUT_MS = 5000;
const SUMMARY_MAX = 160;
const EXIT_PERMANENT = 1;
const EXIT_USAGE = 2;
const EXIT_TRANSIENT = 75;

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const MINOR_TAG = /^v?\d+\.\d+\.0$/;
const PATCH_TAG = /^v?\d+\.\d+\.[1-9]\d*$/;
const TOKEN_PATTERN = /^[\x21-\x7e]+$/;
// C0/C1 controls, line and paragraph separators, and bidi embedding, override
// and isolate controls (plus LRM/RLM). The refresh guardrail rejects the same.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

const RETRY = "re-run later";
const CHECK_SCRIPT = "re-run; if it persists, the API response format changed and bin/activity-releases.js needs updating";

const USAGE = `usage: node bin/activity-releases.js [--out <path>] [--no-auth]

  --out <path>     output file    (default: _data/activity.json)
  --no-auth        ignore every token source and run unauthenticated
  --help           print this usage`;

class UsageError extends Error {}

// Twin of Failure in bin/repo-stats.js (#165).
class Failure extends Error {
  constructor(subject, transient, message, action) {
    super(message);
    this.subject = subject;
    this.transient = transient;
    this.action = action;
  }
}

function parseArgs(argv) {
  const opts = { out: "_data/activity.json", noAuth: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--no-auth") opts.noAuth = true;
    else if (flag === "--help") opts.help = true;
    else if (flag === "--out") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new UsageError(`${flag} needs a path`);
      opts.out = value;
    } else throw new UsageError(`unknown option: ${flag}`);
  }
  return opts;
}

function apiOrigin() {
  let url;
  try {
    url = new URL(API_BASE);
  } catch {
    throw new UsageError(`ACTIVITY_API_BASE is not a URL: ${API_BASE}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UsageError(`ACTIVITY_API_BASE must be http(s): ${API_BASE}`);
  if (url.username || url.password) throw new UsageError("ACTIVITY_API_BASE must not contain a username or password");
  return url.origin;
}

// Short names key the output (and #74's overrides), so two repos with the same
// name under different owners would collide. Checked before any request.
function shortNames() {
  const names = new Map();
  for (const repo of RELEASE_REPOS) {
    if (!REPO_PATTERN.test(repo)) {
      throw new Failure("RELEASE_REPOS", false, `${JSON.stringify(repo)} is not an owner/name`, "fix RELEASE_REPOS in bin/activity-releases.js");
    }
    const name = repo.split("/")[1];
    if (names.has(name)) {
      throw new Failure(
        "RELEASE_REPOS",
        false,
        `${repo} and ${names.get(name)} share the short name ${name}`,
        "RELEASE_REPOS short names must be unique; the output keys releases by them"
      );
    }
    names.set(name, repo);
  }
  return names;
}

// Twin of checkToken in bin/repo-stats.js (#165).
function checkToken(token, source) {
  const trimmed = token.trim();
  if (!TOKEN_PATTERN.test(trimmed)) {
    throw new Failure(source, false, "token contains whitespace or non-ASCII characters", `fix or unset the token in ${source}`);
  }
  return { token: trimmed, source };
}

// Twin of resolveAuth in bin/repo-stats.js (#165).
function resolveAuth(noAuth) {
  if (noAuth) return { token: null, source: "none (--no-auth)" };
  if (API_OVERRIDDEN) return { token: null, source: "none (ACTIVITY_API_BASE set)" };
  if (process.env.GITHUB_TOKEN) return checkToken(process.env.GITHUB_TOKEN, "GITHUB_TOKEN");
  if (process.env.GH_TOKEN) return checkToken(process.env.GH_TOKEN, "GH_TOKEN");
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GH_TIMEOUT_MS,
    });
    if (token.trim()) return checkToken(token, "gh auth token");
  } catch (err) {
    if (err instanceof Failure) throw err;
    if (err.code === "ETIMEDOUT") return { token: null, source: "none (gh auth token timed out)" };
  }
  return { token: null, source: "none (no token found)" };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Twin of get in bin/repo-stats.js (#165): retries network errors, timeouts
// and 5xx; returns every other response. Reports only an error's code or name.
async function get(subject, url, headers) {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.status < 500) return res;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = `network error: ${err.cause?.code || err.cause?.name || err.name}`;
    }
    if (attempt < ATTEMPTS) await sleep(1000 * attempt);
  }
  throw new Failure(subject, true, `transient: ${last} after ${ATTEMPTS} attempts`, RETRY);
}

// Twin of readBody in bin/repo-stats.js (#165).
async function readBody(subject, res, kind) {
  try {
    return kind === "json" ? await res.json() : await res.text();
  } catch (err) {
    throw new Failure(subject, true, `transient: unreadable response body (${err.cause?.code || err.name})`, RETRY);
  }
}

// Twin of rateLimitFailure in bin/repo-stats.js (#165).
async function rateLimitFailure(subject, res) {
  if (res.status === 429) return new Failure(subject, true, "transient: rate limited (HTTP 429)", RETRY);
  if (res.status !== 403) return null;
  if (res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const at = reset ? new Date(reset * 1000).toISOString() : "the next hour";
    return new Failure(subject, true, `transient: API rate limit exhausted (resets ${at})`, RETRY);
  }
  const body = await readBody(subject, res, "text");
  if (res.headers.get("retry-after") || /secondary rate limit|abuse/i.test(body)) {
    return new Failure(subject, true, "transient: secondary rate limit (HTTP 403)", RETRY);
  }
  return null;
}

function nextLink(header) {
  if (!header) return null;
  for (const part of header.split(",")) {
    const m = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (m) return m[1];
  }
  return null;
}

// Every release of one repo, following pagination. GitHub's next link often
// points at /repositories/<id>/releases rather than /repos/<owner>/<name>/, so
// only its origin is checked, and it must be the API base's own before the
// request (with any token) is sent. This covers Link pagination only; HTTP
// redirects are fetch's (see the header).
async function fetchReleases(repo, origin, headers, auth) {
  let url = `${API_BASE.replace(/\/+$/, "")}/repos/${repo}/releases?per_page=${PER_PAGE}`;
  const releases = [];
  for (let page = 1; ; page++) {
    if (page > PAGE_CAP) {
      throw new Failure(
        repo,
        false,
        `has more than ${PAGE_CAP * PER_PAGE} releases (${PAGE_CAP} pages)`,
        "raise PAGE_CAP in bin/activity-releases.js and recompute timeout-minutes in .github/workflows/activity-releases.yml"
      );
    }
    const res = await get(repo, url, headers);
    if (res.status === 404) {
      throw new Failure(
        repo,
        false,
        "returned 404 (deleted, made private, or renamed)",
        "fix or remove it in RELEASE_REPOS, then run node bin/activity-releases.js locally and commit both files"
      );
    }
    if (res.status === 401) {
      if (auth.token) throw new Failure(repo, false, "token rejected (HTTP 401)", `fix or unset the token in ${auth.source}`);
      throw new Failure(repo, false, "HTTP 401 on an unauthenticated request", API_OVERRIDDEN ? "check ACTIVITY_API_BASE" : CHECK_SCRIPT);
    }
    const limited = await rateLimitFailure(repo, res);
    if (limited) throw limited;
    if (res.status === 408) throw new Failure(repo, true, "transient: HTTP 408", RETRY);
    if (!res.ok) throw new Failure(repo, false, `returned HTTP ${res.status}`, `check https://github.com/${repo} is reachable, then ${RETRY}`);
    const data = await readBody(repo, res, "json");
    if (!Array.isArray(data)) throw new Failure(repo, true, "transient: response is not a JSON array", RETRY);
    releases.push(...data);
    const next = nextLink(res.headers.get("link"));
    if (!next) return releases;
    let nextUrl;
    try {
      nextUrl = new URL(next, url);
    } catch {
      throw new Failure(repo, false, "pagination link is not a URL", CHECK_SCRIPT);
    }
    if (nextUrl.origin !== origin) {
      throw new Failure(
        repo,
        false,
        `pagination link points off the API origin (${nextUrl.origin})`,
        "not followed, so no token was sent; check the API response before re-running"
      );
    }
    url = nextUrl.href;
  }
}

const quote = (v) => JSON.stringify(String(v).slice(0, 80));

// The fields this script reads, checked on every release before any is used.
function checkRelease(repo, r) {
  if (r === null || typeof r !== "object" || Array.isArray(r)) return "a release is not an object";
  if (typeof r.tag_name !== "string" || r.tag_name.trim() === "") return "a release has no tag_name";
  const tag = quote(r.tag_name);
  if (typeof r.draft !== "boolean" || typeof r.prerelease !== "boolean") return `release ${tag} has no boolean draft/prerelease`;
  if (r.body !== null && r.body !== undefined && typeof r.body !== "string") return `release ${tag} has a non-string body`;
  if (r.draft) return null;
  if (typeof r.published_at !== "string" || Number.isNaN(Date.parse(r.published_at))) return `release ${tag} has no valid published_at`;
  const prefix = `https://github.com/${repo}/releases/`.toLowerCase();
  if (typeof r.html_url !== "string" || !r.html_url.toLowerCase().startsWith(prefix) || /[\s"'<>]/.test(r.html_url)) {
    return `release ${tag} has an html_url outside ${prefix}`;
  }
  return null;
}

const BULLET = /^ {0,3}[*-]\s+/;
const HEADING = /^#{1,6}\s/;
const isDependabot = (b) => /@dependabot\b/i.test(b) || /^(chore|build)\(deps/i.test(b) || /^bump\s/i.test(b);
const isFirstContribution = (b) => /^@\S+ made their first contribution\b/i.test(b);
const usable = (b) => !isDependabot(b) && !isFirstContribution(b);
const isFeat = (b) => /^feat(\([^)]*\))?!?:\s/i.test(b);

// Lines after the first heading matching `heading`, up to the next heading.
function section(lines, heading) {
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return null;
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (HEADING.test(line)) break;
    out.push(line);
  }
  return out;
}

const bullets = (lines) => lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, "").trim());
const featFirst = (bs) => [...bs.filter(isFeat), ...bs.filter((b) => !isFeat(b))];

// Candidate bullets in order of preference, chosen by the body's shape. A
// recognized section is final even when nothing usable is left in it: falling
// through to the whole body would reach `## New Contributors`.
function candidates(body) {
  const lines = (body || "").split(/\r?\n/);
  const features = section(lines, /^###\s+Features\s*$/i);
  if (features) return bullets(features).filter(usable);
  const changed = section(lines, /^##\s+What['\u2019]s Changed\s*$/i);
  if (changed) return featFirst(bullets(changed).filter(usable));
  return featFirst(bullets(lines).filter(usable));
}

// Drop balanced parenthetical groups from the end of `s`, one at a time.
function stripTrailingParens(s) {
  for (;;) {
    s = s.trimEnd();
    if (!s.endsWith(")")) return s;
    let depth = 0;
    let open = -1;
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ")") depth++;
      else if (s[i] === "(" && --depth === 0) {
        open = i;
        break;
      }
    }
    if (open < 0) return s;
    s = s.slice(0, open);
  }
}

function clean(bullet) {
  let s = bullet;
  s = s.replace(/\s+by\s+@[\w.[\]-]+\s+in\s+\S+\s*$/i, ""); // GitHub's "by @user in <PR url>"
  s = s.replace(/,\s*closes\s+.*$/i, ""); // release-please's ", closes [#9](url)"
  s = s.replace(/\[([^\]]*)\]\((?:[^()\s]|\([^()\s]*\))*\)/g, "$1"); // links to their text (one level of parens in the URL), before parentheses are stripped
  s = s.replace(/^\*\*([^*]+?):\*\*\s*/, "$1: "); // release-please's **scope:**
  s = s.replace(/\*\*|`/g, "");
  s = s.replace(/^feat\(([^)]+)\)!?:\s*/i, "$1: ").replace(/^feat!?:\s*/i, "");
  s = stripTrailingParens(s);
  s = s.replace(UNSAFE_CHARS, " ");
  // Drop every angle bracket rather than stripping tags: a tag-matching regex
  // can be defeated by nesting, and plain text needs neither.
  s = s.replace(/[<>]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  // Count and cut by code point, so the cap never splits a surrogate pair.
  const points = Array.from(s);
  if (points.length > SUMMARY_MAX) {
    let cut = points.slice(0, SUMMARY_MAX - 1).join("");
    const space = cut.lastIndexOf(" ");
    if (space > SUMMARY_MAX / 2) cut = cut.slice(0, space);
    s = cut.replace(/[\s,;:.\-\u2013\u2014]+$/, "") + "\u2026";
  }
  return s;
}

function summarize(body) {
  for (const candidate of candidates(body)) {
    const s = clean(candidate);
    if (s) return s;
  }
  return null;
}

// The current file, as the set of short repo names it has releases for, or
// null when there is none (a first run). A file that exists but is unreadable
// or not this script's shape fails the run, so it never reads as a first run.
function lastGood(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new Failure(file, false, `cannot read (${err.code || err.name})`, "fix the file's permissions, then re-run");
  }
  const restore = `restore it with git checkout HEAD -- ${file}, then re-run`;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Failure(file, false, "exists but is not valid JSON", restore);
  }
  if (data === null || typeof data !== "object" || !Array.isArray(data.releases) || !data.releases.every((r) => r && typeof r.repo === "string")) {
    throw new Failure(file, false, "exists but is not a releases file (no releases array of entries with a repo)", restore);
  }
  return new Set(data.releases.map((r) => r.repo));
}

// Twin of sameData in bin/repo-stats.js (#165).
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

// Twin of writeAtomically in bin/repo-stats.js (#165).
function writeAtomically(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Twin of report in bin/repo-stats.js (#165).
function report(failure) {
  console.error(`error: ${failure.subject}: ${failure.message}`);
  console.error(`  action: ${failure.action}`);
}

const isoSeconds = (s) => new Date(s).toISOString().replace(/\.\d{3}Z$/, "Z");

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  const origin = apiOrigin();
  const names = shortNames();
  const prior = lastGood(opts.out);
  const auth = resolveAuth(opts.noAuth);
  console.log(
    `${RELEASE_REPOS.length} repos; auth: ${auth.source}; ${prior ? `current file has releases for ${prior.size} repos` : "no current file (first run)"}`
  );

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "activity-releases",
  };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const failures = [];
  const releases = [];
  for (const [name, repo] of names) {
    let raw;
    try {
      raw = await fetchReleases(repo, origin, headers, auth);
    } catch (err) {
      if (!(err instanceof Failure)) throw err;
      failures.push(err);
      continue;
    }
    // An empty list blanks a repo's releases, so it is a failure unless the
    // current file has none for it (a repo yet to release, or a first run).
    if (raw.length === 0) {
      if (prior && prior.has(name)) {
        failures.push(
          new Failure(
            repo,
            true,
            "transient: returned no releases, but the current file has releases for it",
            `${RETRY}; if it persists and its releases really were all deleted, remove it from RELEASE_REPOS, run node bin/activity-releases.js locally and commit both files`
          )
        );
      }
      continue;
    }
    const problem = raw.map((r) => checkRelease(repo, r)).find(Boolean);
    if (problem) {
      failures.push(new Failure(repo, false, problem, CHECK_SCRIPT));
      continue;
    }
    const kept = [];
    let bad = null;
    for (const r of raw) {
      if (r.draft || r.prerelease || PATCH_TAG.test(r.tag_name)) continue;
      if (!MINOR_TAG.test(r.tag_name)) {
        bad = new Failure(
          repo,
          false,
          `published release ${quote(r.tag_name)} has a tag that is neither vX.Y.0 nor a vX.Y.Z patch`,
          "extend MINOR_TAG/PATCH_TAG in bin/activity-releases.js for the new tag format (or mark the release a pre-release on GitHub), then re-run"
        );
        break;
      }
      kept.push({ repo: name, tag: r.tag_name, date: isoSeconds(r.published_at), summary: summarize(r.body), url: r.html_url });
    }
    if (bad) {
      failures.push(bad);
      continue;
    }
    releases.push(...kept);
  }

  if (failures.length) {
    failures.forEach(report);
    const transientOnly = failures.every((f) => f.transient);
    console.error(`${opts.out} left unchanged (${transientOnly ? "transient" : "permanent"} failure).`);
    return transientOnly ? EXIT_TRANSIENT : EXIT_PERMANENT;
  }

  const keys = new Set();
  for (const r of releases) {
    const key = `${r.repo}@${r.tag}`;
    if (keys.has(key)) throw new Failure(key, false, "appears twice", CHECK_SCRIPT);
    keys.add(key);
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  releases.sort((a, b) => cmp(b.date, a.date) || cmp(a.repo, b.repo) || cmp(a.tag, b.tag));

  const output = {
    _generated_by: "bin/activity-releases.js — do not edit by hand",
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    releases,
  };
  if (sameData(opts.out, output)) {
    console.log(`${opts.out} unchanged.`);
    return 0;
  }
  try {
    writeAtomically(opts.out, JSON.stringify(output, null, 2) + "\n");
  } catch (err) {
    throw new Failure(opts.out, false, `cannot write (${err.code || err.name})`, "pass an --out path in an existing, writable directory");
  }
  const perRepo = [...names.keys()].map((n) => `${n} ${releases.filter((r) => r.repo === n).length}`).join(", ");
  console.log(`wrote ${opts.out} (${releases.length} releases: ${perRepo}).`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    if (err instanceof UsageError) {
      console.error(`usage error: ${err.message}`);
      console.error(USAGE);
      process.exitCode = EXIT_USAGE;
    } else if (err instanceof Failure) {
      report(err);
      process.exitCode = err.transient ? EXIT_TRANSIENT : EXIT_PERMANENT;
    } else {
      console.error(`unexpected error: ${err.stack || err}`);
      process.exitCode = EXIT_PERMANENT;
    }
  }
);
