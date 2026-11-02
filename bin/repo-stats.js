#!/usr/bin/env node
/**
 * Fetch the /repositories/ page's repo and profile facts from the GitHub API
 * into a committed data file.
 *
 * Reads the curated `github_repos` and `github_users` lists and the
 * `repo_language_overrides` map from _data/repositories.yml, preserving list
 * order, fetches each repo and user from api.github.com, and writes
 * _data/repository_stats.json. It runs by hand and weekly from
 * .github/workflows/repo-stats.yml (#59), never inside the Jekyll build, so a
 * GitHub API failure cannot fail a deploy. The page's cards render as native HTML from this file (#56), with
 * no third-party image service (epic #54). Curation stays hand-edited: this
 * script never changes repositories.yml.
 *
 *   node bin/repo-stats.js
 *
 * Options:
 *   --input <path>   curated list   (default: _data/repositories.yml)
 *   --out <path>     output file    (default: _data/repository_stats.json)
 *   --no-auth        ignore every token source and run unauthenticated
 *   --help           print the usage and options
 *
 * Adding a repo to the page: add its `owner/name` to `github_repos` in
 * _data/repositories.yml, at the position it should appear, then run this
 * script and commit both files. Removing one is the same edit in reverse, plus
 * removing its `repo_language_overrides` entry if it has one, or the run fails.
 * A user in `github_users` is added or removed the same way; that list must
 * keep at least one entry. Adding or changing an override also needs a run,
 * which validates it and, when linguist gives its language a color, adds that
 * color to `language_colors`; commit the data file too if the run rewrote it.
 *
 * Auth and rate limits. One pass is one request per curated repo (~12) and per
 * curated user (1), plus one to raw.githubusercontent.com, which is not API
 * quota. That fits the 60/hr unauthenticated limit, so no PAT is needed for
 * local use. A token is used when one is available, taken from the first of:
 * GITHUB_TOKEN, GH_TOKEN, or `gh auth token` if the gh CLI is installed and
 * logged in. In Actions, GITHUB_TOKEN is not in the environment unless the step
 * maps it (`env: GITHUB_TOKEN: ${{ github.token }}`); it allows 1,000
 * requests/hr per repository. A logged-in gh supplies a token silently, so pass
 * --no-auth to exercise the unauthenticated path. With REPO_STATS_API_BASE set,
 * every token source is ignored, so a token never goes to anything but
 * api.github.com. The script logs which source it used and never logs the
 * token; a token that is not printable ASCII is rejected by naming its source
 * only.
 *
 * Output. Repos are keyed by the exact string from repositories.yml, never by
 * the API's `full_name`: Ruby hash keys are case-sensitive and GitHub names are
 * not, so a casing mismatch would be a silent blank card. Look a repo up as
 * `site.data.repository_stats.repos[repo]`. Users are keyed the same way, by
 * the curated login, under `users` (`site.data.repository_stats.users[user]`)
 * for the profile summary (#58); a blank name or bio is written as null.
 * Language colors come from linguist's languages.yml (the REST API returns the
 * language name, not its color). `language_colors` is keyed by language name
 * and covers each repo's detected language and each override value, when
 * linguist gives it a color. A language linguist lists without a color is left
 * out, and a card showing it gets no dot. Repos carry no color of their own:
 * the card looks its displayed language up in `language_colors`. The output
 * is JSON rather than YAML because a raw control or line-separator character in
 * a description can make Ruby's YAML parser reject the file, which would fail
 * the whole site build.
 *
 * Failure policy. Everything is validated before anything is written, so a
 * failed run leaves the existing file untouched. A run whose data matches the
 * existing file, ignoring `generated_at`, also leaves it untouched, so
 * `generated_at` means "data last changed at". A curated repo that returns 404
 * or is not public fails the run: a dead repo on a portfolio page is a
 * curation problem, and a human must remove it from repositories.yml. A repo
 * with no detected language fails unless it has an override. One whose
 * language linguist does not list fails too, but only warns when an override
 * replaces that language on the card, so a stale LINGUIST_TAG cannot fail runs
 * over a language the page never shows. Every override key must be spelled
 * exactly as in `github_repos`, and every value exactly as linguist spells the
 * language, because the card matches both case-sensitively. A curated user
 * fails the run when it returns 404 (deleted, suspended, or renamed: update
 * the login or remove it) or is not a personal account (remove it). A user
 * response with no `type`, a repo response whose `language` is neither a
 * string nor null, a login that differs beyond case from the curated one, or
 * an avatar URL that is not plain https on avatars.githubusercontent.com also
 * fails, as an API-format problem rather than a curation one. Both lists must
 * be non-empty block lists: a missing, empty or flow-form list fails rather
 * than silently dropping what the page shows. The override map may be absent
 * or empty, but a flow-form one fails for the same reason. So does any other
 * top-level line, since a form of the map this reader does not recognize
 * would otherwise read as no map while Jekyll still applies it. A transient
 * failure (5xx, network error, timeout, rate limit, unreadable response) also
 * fails the run, with its own exit code, which tells a scheduled job to retry
 * rather than ask a human to edit the curation. Override keys are checked
 * before any request, so a bad key always exits 1. Override values and
 * detected languages are checked against linguist, so while linguist is
 * unreachable those checks are skipped: a bad value then exits 75 with the
 * linguist error, and exits 1 on the first run linguist answers. Every error
 * line is followed by the action that resolves it, except an unexpected
 * exception, which is a bug in this script and prints its stack.
 *
 * Exit codes: 0 written or unchanged; 1 permanent failure (404, not public,
 * not a user, bad token, validation); 75 transient failures only; 2 usage error.
 * bin/repo-stats-refresh.sh, which the weekly workflow runs, branches on these
 * codes and turns the `error:`/`action:`/`warning:` stderr lines into Actions
 * annotations, so keep that format.
 *
 * REPO_STATS_API_BASE overrides https://api.github.com. It exists only to
 * exercise failure paths against a local stub or an unreachable host, and a
 * run with it set is always unauthenticated.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const API_OVERRIDDEN = Boolean(process.env.REPO_STATS_API_BASE);
const API_BASE = API_OVERRIDDEN ? process.env.REPO_STATS_API_BASE : "https://api.github.com";
// Pinned so colors only change when this constant does.
const LINGUIST_TAG = "v9.7.0";
const LINGUIST_URL = `https://raw.githubusercontent.com/github-linguist/linguist/${LINGUIST_TAG}/lib/linguist/languages.yml`;
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15000;
const GH_TIMEOUT_MS = 5000;
const EXIT_PERMANENT = 1;
const EXIT_USAGE = 2;
const EXIT_TRANSIENT = 75;

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const TOKEN_PATTERN = /^[\x21-\x7e]+$/;

const RETRY = "re-run later";
const REMOVE_REPO = "remove it from _data/repositories.yml";
const REMOVE_USER = "remove it from github_users in _data/repositories.yml";
// A renamed repo redirects, so its 404 is never a rename; a renamed user 404s.
const REPO_GONE = { why: "deleted, made private, or the name reused", action: REMOVE_REPO };
const USER_GONE = { why: "deleted, renamed, or suspended", action: `update it to the account's current login, or ${REMOVE_USER}` };
const CHECK_SCRIPT = "re-run; if it persists, the API response format changed and bin/repo-stats.js needs updating";

const USAGE = `usage: node bin/repo-stats.js [--input <path>] [--out <path>] [--no-auth]

  --input <path>   curated list   (default: _data/repositories.yml)
  --out <path>     output file    (default: _data/repository_stats.json)
  --no-auth        ignore every token source and run unauthenticated
  --help           print this usage`;

class UsageError extends Error {}

// A failure attributable to one subject (a repo, a user, linguist, or an input),
// carrying its class and the action that resolves it, so every error the run
// prints says whether to retry or what a human must change.
class Failure extends Error {
  constructor(subject, transient, message, action) {
    super(message);
    this.subject = subject;
    this.transient = transient;
    this.action = action;
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
      if (!value || value.startsWith("--")) throw new UsageError(`${flag} needs a path`);
      opts[flag.slice(2)] = value;
    } else throw new UsageError(`unknown option: ${flag}`);
  }
  return opts;
}

function checkApiBase() {
  let url;
  try {
    url = new URL(API_BASE);
  } catch {
    throw new UsageError(`REPO_STATS_API_BASE is not a URL: ${API_BASE}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UsageError(`REPO_STATS_API_BASE must be http(s): ${API_BASE}`);
  // fetch refuses a URL with credentials in it; say so now rather than retry.
  if (url.username || url.password) throw new UsageError("REPO_STATS_API_BASE must not contain a username or password");
}

// A strict reader for the three blocks this script needs, so it carries no
// YAML dependency. It fails on anything it does not understand rather than
// guessing, because a silently dropped or truncated line is a repo or user
// silently missing from the page.
function readSource(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    throw new Failure(file, false, `cannot read the curated list (${err.code || err.name})`, "pass the right --input path");
  }
  // An editor's byte-order mark would hide the key on line 1 from findBlock;
  // Jekyll ignores it.
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  // YAML 1.1 (libyaml, which Jekyll's Psych uses) also breaks lines on a lone
  // CR, NEL, LS and PS. A line holding one is two lines to Jekyll, so a comment
  // line could hide a key or an entry from every reader here while Jekyll
  // applies it.
  const n = lines.findIndex((l) => /[\r\u0085\u2028\u2029]/.test(l));
  if (n >= 0) {
    const code = lines[n]
      .match(/[\r\u0085\u2028\u2029]/)[0]
      .charCodeAt(0)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    throw new Failure(
      file,
      false,
      `line ${n + 1}: contains U+${code}, which Jekyll's YAML reader treats as a line break`,
      "remove it, or convert the line endings to LF"
    );
  }
  return lines;
}

// Finds the line a top-level block starts on, or -1 for an `optional` block
// with no copy at all. The start must be the bare key, but the duplicate check
// is loose, so a second copy written quoted or in flow form (`"key":`,
// `key: [a]`) is caught too: YAML keeps the last of a duplicated key, so
// reading the first would fetch a list the page never shows. `shape` names the
// block in errors.
function findBlock(file, lines, key, { shape = "block list", optional = false } = {}) {
  const fix = "fix _data/repositories.yml";
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*(#.*)?$`).test(l));
  const anyCopy = new RegExp(`^["']?${key}["']?\\s*:`);
  const copies = lines.filter((l) => anyCopy.test(l)).length;
  if (start < 0) {
    if (optional && copies === 0) return -1;
    throw new Failure(file, false, `no top-level \`${key}:\` key starting a ${shape}`, fix);
  }
  if (copies > 1) throw new Failure(file, false, `\`${key}:\` appears more than once`, fix);
  return start;
}

// Reads the block list under `key`, each item matching `pattern` (`what`
// names it in errors). An empty or missing list fails: both lists drive the page.
function readList(file, lines, key, pattern, what) {
  const fix = "fix _data/repositories.yml";
  const start = findBlock(file, lines, key);
  const items = [];
  const seen = new Map();
  for (let n = start + 1; n < lines.length; n++) {
    const line = lines[n];
    // The block ends at the next top-level key; a column-0 comment or item
    // does not end it.
    if (/^[^\s#-]/.test(line)) break;
    const text = line.trim();
    if (text === "" || text.startsWith("#")) continue;
    // As in YAML, `#` starts a comment only after whitespace, so `a/b#c` is
    // one value (and fails the pattern), never `a/b` plus a comment.
    const m = /^-\s+(["']?)([^"'\s]+)\1(?:\s+#.*)?$/.exec(text);
    if (!m) throw new Failure(file, false, `line ${n + 1}: not a list item: ${text}`, fix);
    const item = m[2];
    if (!pattern.test(item)) throw new Failure(file, false, `line ${n + 1}: not ${what}: ${item}`, fix);
    // GitHub names are case-insensitive, so two spellings are one repo or user.
    const folded = item.toLowerCase();
    if (seen.has(folded)) throw new Failure(file, false, `line ${n + 1}: ${item} duplicates line ${seen.get(folded)}`, fix);
    seen.set(folded, n + 1);
    items.push(item);
  }
  if (items.length === 0) throw new Failure(file, false, `\`${key}\` lists nothing`, fix);
  return items;
}

// One `owner/name: Language` entry, in a subset of what Jekyll's YAML reader
// (SafeYAML, on Psych) accepts: a quoted key or value may not contain a quote
// character or `\`; a plain value does not start with a YAML indicator, may
// hold spaces and `'` (`Cap'n Proto`) but not `: `, and keeps a `#` with no
// whitespace before it (`C#`); a plain key is held to owner/name characters by
// REPO_PATTERN in readMap. A plain value SafeYAML would read as a boolean,
// null, number or date (`yes`, `~`, `123`) passes this pattern and is rejected
// only by checkOverrideLanguages, because no linguist name is such a scalar.
const MAP_ENTRY =
  /^(?:"([^"'\\]+)"|'([^"'\\]+)'|([^\s"'#:][^\s:]*)): +(?:"([^"'\\]+)"|'([^"'\\]+)'|([^\s\-?:,[\]{}#&*!|>'"%@`](?:[^:#\t]|:(?! |$)|(?<! )#)*?)) *(?: #.*)?$/;

// Reads the block mapping under `key` into owner/name → { language, line }. An
// absent or empty block is no entries: the map only corrects some cards. Every
// entry must share the first one's indent, since Psych would nest or reject a
// line indented differently.
function readMap(file, lines, key) {
  const fix = "fix _data/repositories.yml";
  const entries = new Map();
  const start = findBlock(file, lines, key, { shape: "block mapping", optional: true });
  if (start < 0) return entries;
  const seen = new Map();
  let indent = null;
  for (let n = start + 1; n < lines.length; n++) {
    const line = lines[n];
    if (/^[^\s#-]/.test(line)) break;
    const text = line.trim();
    if (text === "" || text.startsWith("#")) continue;
    const lead = /^ */.exec(line)[0];
    if (lead === "") throw new Failure(file, false, `line ${n + 1}: not a mapping entry: ${text}`, fix);
    if (indent === null) indent = lead;
    else if (lead !== indent) {
      throw new Failure(file, false, `line ${n + 1}: indented ${lead.length} spaces, not ${indent.length} like the first entry`, fix);
    }
    const m = MAP_ENTRY.exec(line.slice(lead.length));
    if (!m) {
      const why = /^[^\s:]+:\s*(#.*)?$/.test(text) ? "has no language" : "not a mapping entry";
      throw new Failure(file, false, `line ${n + 1}: ${why}: ${text}`, fix);
    }
    const repo = m[1] ?? m[2] ?? m[3];
    const language = m[4] ?? m[5] ?? m[6];
    if (!REPO_PATTERN.test(repo)) throw new Failure(file, false, `line ${n + 1}: not an owner/name: ${repo}`, fix);
    const folded = repo.toLowerCase();
    if (seen.has(folded)) throw new Failure(file, false, `line ${n + 1}: ${repo} duplicates line ${seen.get(folded)}`, fix);
    seen.set(folded, n + 1);
    entries.set(repo, { language, line: n + 1 });
  }
  return entries;
}

// The file may hold only the three bare block starts at the top level, plus
// comments, column-0 list items, and `---` as the first line that is not blank
// or a comment. Any other top-level line fails: an anchored, tagged, explicit
// (`? key`), merged or escaped spelling of a key would otherwise read here as
// an absent map while Jekyll still applies it, and content after a `...`
// document end or a later `---` would be read here and ignored by Jekyll,
// which reads only the first document.
function checkTopLevel(file, lines) {
  const keys = /^(?:github_users|github_repos|repo_language_overrides):\s*(#.*)?$/;
  let first = true;
  lines.forEach((line, n) => {
    if (/^\s*(#.*)?$/.test(line)) return;
    const isFirst = first;
    first = false;
    if (!/^[^\s#]/.test(line) || /^-(\s|$)/.test(line) || keys.test(line)) return;
    if (isFirst && /^---\s*(#.*)?$/.test(line)) return;
    throw new Failure(
      file,
      false,
      `line ${n + 1}: only github_users, github_repos and repo_language_overrides may appear at the top level, each as a bare key: ${line}`,
      "fix _data/repositories.yml"
    );
  });
}

// An override key the card cannot match is an override that silently does
// nothing, so it fails here, before any request, as a curation error.
function checkOverrideKeys(file, overrides, repos) {
  const curated = new Map(repos.map((r) => [r.toLowerCase(), r]));
  for (const [repo, { line }] of overrides) {
    const match = curated.get(repo.toLowerCase());
    if (match === repo) continue;
    if (match) {
      throw new Failure(
        file,
        false,
        `line ${line}: override key ${repo} differs only in case from ${match} in github_repos`,
        `change the key to ${match}`
      );
    }
    throw new Failure(file, false, `line ${line}: override key ${repo} is not in github_repos`, "fix the key, or remove the override");
  }
}

// Override values need linguist, so they are checked once it is read. Returns
// one Failure per value linguist does not list.
function checkOverrideLanguages(file, overrides, linguist) {
  const byFolded = new Map([...linguist.keys()].map((l) => [l.toLowerCase(), l]));
  const failures = [];
  for (const [repo, { language, line }] of overrides) {
    if (linguist.has(language)) continue;
    const near = byFolded.get(language.toLowerCase());
    failures.push(
      new Failure(
        file,
        false,
        `line ${line}: override for ${repo}: "${language}" is not a language linguist ${LINGUIST_TAG} lists${near ? ` (it lists "${near}")` : ""}`,
        near ? `write it as "${near}"` : "use linguist's exact language name, or bump LINGUIST_TAG in bin/repo-stats.js if a newer release lists it"
      )
    );
  }
  return failures;
}

// Rejecting a malformed token here is what keeps it out of the logs: fetch
// quotes an invalid header value, token included, in the error it throws.
function checkToken(token, source) {
  const trimmed = token.trim();
  if (!TOKEN_PATTERN.test(trimmed)) {
    throw new Failure(source, false, "token contains whitespace or non-ASCII characters", `fix or unset the token in ${source}`);
  }
  return { token: trimmed, source };
}

function resolveAuth(noAuth) {
  if (noAuth) return { token: null, source: "none (--no-auth)" };
  // An overridden API base is a stub or test host: never send it a real token.
  if (API_OVERRIDDEN) return { token: null, source: "none (REPO_STATS_API_BASE set)" };
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
    // gh missing or logged out: fall through to unauthenticated.
  }
  return { token: null, source: "none (no token found)" };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GET with in-run retries for the failures worth retrying at once: network
// errors, timeouts and 5xx. Every other response is returned for the caller
// to classify. The timeout signal also bounds reading the body. Only the
// error's code or name is reported, never its message, which can quote
// request headers.
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

// A body that fails to arrive or parse is a bad response, not a bad repo or user.
async function readBody(subject, res, kind) {
  try {
    return kind === "json" ? await res.json() : await res.text();
  } catch (err) {
    throw new Failure(subject, true, `transient: unreadable response body (${err.cause?.code || err.name})`, RETRY);
  }
}

// 429 is a rate limit by definition; a 403 is one when its headers or body say
// so. GitHub sends `retry-after` only sometimes.
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

// Returns every language linguist lists, mapped to its color or to null when
// it has none. This decides whether a language exists, not just its color.
// The scan reads unquoted top-level keys and 2-space `color: "#rrggbb"` lines,
// which at v9.7.0 covers every key (none is quoted or contains `:`) and every
// color line (692 of 692). MAP_ENTRY also relies on no language name, unquoted,
// being a YAML 1.1 boolean, null, number or date. Recheck all three after a
// LINGUIST_TAG bump.
async function fetchLinguist() {
  const res = await get("linguist", LINGUIST_URL, { "User-Agent": "repo-stats" });
  const limited = await rateLimitFailure("linguist", res);
  if (limited) throw limited;
  if (res.status === 408) throw new Failure("linguist", true, "transient: HTTP 408", RETRY);
  if (!res.ok)
    throw new Failure(
      "linguist",
      false,
      `${LINGUIST_URL} returned HTTP ${res.status}`,
      "check LINGUIST_TAG in bin/repo-stats.js names a real linguist release"
    );
  const languages = new Map();
  let current = null;
  for (const line of (await readBody("linguist", res, "text")).split("\n")) {
    const key = /^([^\s#-][^:]*):\s*$/.exec(line);
    if (key) {
      current = key[1];
      languages.set(current, null);
      continue;
    }
    // Only a 2-space-indented color directly under the current language.
    const color = /^ {2}color: "(#[0-9a-fA-F]{6})"\s*$/.exec(line);
    if (current && color) languages.set(current, color[1]);
  }
  // linguist lists 800+ languages. The tag is immutable, so far fewer usually
  // means a bad response (an error or captive-portal page), not a new format.
  const colored = [...languages.values()].filter(Boolean).length;
  if (languages.size < 300 || colored < 300) {
    throw new Failure(
      "linguist",
      true,
      `transient: response does not look like languages.yml (${languages.size} languages, ${colored} colors)`,
      `${RETRY}; if it persists after a LINGUIST_TAG bump, the file's format changed and the scan in bin/repo-stats.js needs updating`
    );
  }
  return languages;
}

// GET one API object, classifying every failure. `subject` is the curated repo
// or user; `gone` says why such a subject returns 404 and what resolves it.
async function fetchJson(subject, url, headers, auth, gone) {
  const res = await get(subject, url, headers);
  if (res.status === 404) {
    return new Failure(subject, false, `returned 404 (${gone.why})`, gone.action);
  }
  if (res.status === 401) {
    if (auth.token) return new Failure(subject, false, "token rejected (HTTP 401)", `fix or unset the token in ${auth.source}`);
    return new Failure(subject, false, "HTTP 401 on an unauthenticated request", API_OVERRIDDEN ? "check REPO_STATS_API_BASE" : CHECK_SCRIPT);
  }
  const limited = await rateLimitFailure(subject, res);
  if (limited) return limited;
  if (res.status === 408) return new Failure(subject, true, "transient: HTTP 408", RETRY);
  if (!res.ok) return new Failure(subject, false, `returned HTTP ${res.status}`, `check https://github.com/${subject} is reachable, then ${RETRY}`);
  const data = await readBody(subject, res, "json");
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return new Failure(subject, true, "transient: response is not a JSON object", RETRY);
  }
  return data;
}

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
const count = (v) => Number.isInteger(v) && v >= 0;

// Validate one API response and project it to the fields the page uses, in a
// fixed order. Each problem carries the action that fixes it. `linguist` is
// null when linguist itself failed, in which case only the is-it-listed check
// is skipped, rather than reported as an unknown language; a missing detected
// language is still checked. `override` is the repo's
// repo_language_overrides value, if any: the card shows it instead of the
// detected language, so a blank or unknown detected language does not fail.
function shapeRepo(repo, d, linguist, override) {
  const problems = [];
  const warnings = [];
  const add = (message, action) => problems.push({ message, action });
  if (d.visibility === undefined) {
    add("response has no visibility field", CHECK_SCRIPT);
    return { problems };
  }
  if (d.private === true || d.visibility !== "public") {
    add("is not public", REMOVE_REPO);
    return { problems };
  }
  const typed = d.language === null || typeof d.language === "string";
  const language = typed && nonEmpty(d.language) ? d.language : null;
  if (!nonEmpty(d.full_name)) add("missing full_name", CHECK_SCRIPT);
  if (!nonEmpty(d.owner?.login)) add("missing owner", CHECK_SCRIPT);
  if (!nonEmpty(d.description)) add("has no description", `add one on GitHub, or ${REMOVE_REPO}`);
  if (!typed) add("response language is neither a string nor null", CHECK_SCRIPT);
  else if (language === null) {
    if (override === undefined) {
      add("has no detected language", `push code GitHub can detect a language for, add it to repo_language_overrides, or ${REMOVE_REPO}`);
    }
  } else if (linguist && !linguist.has(language)) {
    if (override === undefined) {
      add(
        `language "${language}" is not in linguist ${LINGUIST_TAG}`,
        `bump LINGUIST_TAG in bin/repo-stats.js to a release that lists it, add the repo to repo_language_overrides, or ${REMOVE_REPO}`
      );
    } else {
      warnings.push(
        `language "${language}" is not in linguist ${LINGUIST_TAG} (the card shows its override, ${override}); bump LINGUIST_TAG in bin/repo-stats.js`
      );
    }
  }
  if (!count(d.stargazers_count)) add("missing stargazers_count", CHECK_SCRIPT);
  if (!count(d.forks_count)) add("missing forks_count", CHECK_SCRIPT);
  const homepage = nonEmpty(d.homepage) ? d.homepage.trim() : null;
  if (homepage !== null && !/^https?:\/\/\S+$/i.test(homepage)) {
    add(`homepage is not an http(s) URL: ${homepage}`, "on GitHub, set the repo's website to a full http(s):// URL or clear it");
  }
  if (problems.length) return { problems };

  return {
    problems,
    warnings,
    entry: {
      full_name: d.full_name,
      owner: d.owner.login,
      description: d.description,
      language,
      stargazers_count: d.stargazers_count,
      forks_count: d.forks_count,
      pushed_at: d.pushed_at ?? null,
      topics: Array.isArray(d.topics) ? [...d.topics].sort() : [],
      homepage,
      archived: d.archived === true,
    },
  };
}

// A trimmed string, or null for a missing or blank one, so the template's
// `if` sees an absent field rather than an empty string (which Liquid treats as
// true).
const optional = (v) => (nonEmpty(v) ? v.trim() : null);

// Validate one /users response and project it to the fields the profile summary
// uses. The profile link is built from the curated login, never from the API.
function shapeUser(login, d) {
  const problems = [];
  const add = (message, action) => problems.push({ message, action });
  if (!nonEmpty(d.login)) add("missing login", CHECK_SCRIPT);
  // The section summarizes a person's profile; an organization is a curation mistake.
  if (d.type == null) add("response has no type field", CHECK_SCRIPT);
  else if (d.type !== "User") add(`is a GitHub ${d.type}, not a user`, REMOVE_USER);
  let avatar = null;
  try {
    avatar = new URL(d.avatar_url);
  } catch {
    // reported below
  }
  // It becomes an img src, so pin it to GitHub's avatar host.
  if (
    !avatar ||
    avatar.protocol !== "https:" ||
    avatar.hostname !== "avatars.githubusercontent.com" ||
    avatar.port !== "" ||
    avatar.username ||
    avatar.password
  ) {
    add(`avatar_url is not an https://avatars.githubusercontent.com URL: ${d.avatar_url}`, CHECK_SCRIPT);
  }
  if (!count(d.public_repos)) add("missing public_repos", CHECK_SCRIPT);
  if (!count(d.followers)) add("missing followers", CHECK_SCRIPT);
  if (problems.length) return { problems };

  return {
    problems,
    entry: {
      login: d.login,
      name: optional(d.name),
      bio: optional(d.bio),
      avatar_url: avatar.href,
      public_repos: d.public_repos,
      followers: d.followers,
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
  // A dotfile with a non-data extension, so Jekyll never reads a partial one,
  // and per-process so concurrent runs cannot rename each other's.
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function report(failure) {
  console.error(`error: ${failure.subject}: ${failure.message}`);
  console.error(`  action: ${failure.action}`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  checkApiBase();

  const lines = readSource(opts.input);
  const repos = readList(opts.input, lines, "github_repos", REPO_PATTERN, "an owner/name");
  const users = readList(opts.input, lines, "github_users", LOGIN_PATTERN, "a GitHub login");
  const overrides = readMap(opts.input, lines, "repo_language_overrides");
  checkTopLevel(opts.input, lines);
  checkOverrideKeys(opts.input, overrides, repos);
  const auth = resolveAuth(opts.noAuth);
  console.log(`${repos.length} curated repos, ${users.length} users, ${overrides.size} language overrides; auth: ${auth.source}`);

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repo-stats",
  };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const failures = [];
  let linguist = null;
  try {
    linguist = await fetchLinguist();
  } catch (err) {
    if (!(err instanceof Failure)) throw err;
    failures.push(err);
  }
  if (linguist) failures.push(...checkOverrideLanguages(opts.input, overrides, linguist));

  const entries = {};
  for (const repo of repos) {
    let data;
    try {
      data = await fetchJson(repo, `${API_BASE}/repos/${repo}`, headers, auth, REPO_GONE);
    } catch (err) {
      if (!(err instanceof Failure)) throw err;
      data = err;
    }
    if (data instanceof Failure) {
      failures.push(data);
      continue;
    }
    const { problems, warnings, entry } = shapeRepo(repo, data, linguist, overrides.get(repo)?.language);
    if (problems.length) {
      failures.push(new Failure(repo, false, problems.map((p) => p.message).join("; "), [...new Set(problems.map((p) => p.action))].join("; ")));
      continue;
    }
    for (const w of warnings) console.error(`warning: ${repo}: ${w}`);
    if (entry.full_name !== repo) {
      const kind = entry.full_name.toLowerCase() === repo.toLowerCase() ? "differs only in case from" : "was renamed or transferred to";
      console.error(`warning: ${repo} ${kind} ${entry.full_name}; update _data/repositories.yml`);
    }
    entries[repo] = entry;
  }

  const profiles = {};
  for (const login of users) {
    let data;
    try {
      data = await fetchJson(login, `${API_BASE}/users/${login}`, headers, auth, USER_GONE);
    } catch (err) {
      if (!(err instanceof Failure)) throw err;
      data = err;
    }
    if (data instanceof Failure) {
      failures.push(data);
      continue;
    }
    const { problems, entry } = shapeUser(login, data);
    if (problems.length) {
      failures.push(new Failure(login, false, problems.map((p) => p.message).join("; "), [...new Set(problems.map((p) => p.action))].join("; ")));
      continue;
    }
    // A renamed user 404s rather than redirecting, so a login that differs
    // beyond case means the response is not for the user asked about.
    if (entry.login.toLowerCase() !== login.toLowerCase()) {
      failures.push(new Failure(login, false, `API returned login ${entry.login}`, CHECK_SCRIPT));
      continue;
    }
    if (entry.login !== login) {
      console.error(`warning: ${login} differs only in case from ${entry.login}; update _data/repositories.yml`);
    }
    profiles[login] = entry;
  }

  if (failures.length) {
    failures.forEach(report);
    const transientOnly = failures.every((f) => f.transient);
    console.error(`${opts.out} left unchanged (${transientOnly ? "transient" : "permanent"} failure).`);
    return transientOnly ? EXIT_TRANSIENT : EXIT_PERMANENT;
  }

  // Detected languages of overridden repos stay in, so a card whose override is
  // removed before the next run still finds its color. A null, unknown or
  // colorless language has no color to write.
  const shown = [...Object.values(entries).map((e) => e.language), ...[...overrides.values()].map((o) => o.language)];
  const languages = [...new Set(shown)].filter((l) => l !== null && linguist.get(l)).sort();
  const output = {
    _generated_by: "bin/repo-stats.js — do not edit by hand",
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    language_colors: Object.fromEntries(languages.map((l) => [l, linguist.get(l)])),
    repos: entries,
    users: profiles,
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
  console.log(`wrote ${opts.out} (${repos.length} repos, ${users.length} users, ${languages.length} colored languages).`);
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
