#!/usr/bin/env node
/**
 * Fixture check for the Activity stream template (#168).
 *
 * Builds a throwaway copy of the site with the fixture in
 * bin/fixtures/activity/ in place of the real releases, overrides, posts and
 * notes, then checks what _includes/activity.liquid rendered on /activity/
 * and on the about page. Real data cannot exercise these branches: no real
 * release summary is null or empty or contains HTML, and no real release
 * shares a day with a post and a note. So dropping `| escape` from the
 * template renders byte-identical pages on real data and passes the build.
 *
 * Run it on demand. It is deliberately not in CI or package.json (see
 * "Acceptance without tests" in .claude/loop.config.md). Run it after
 * changing any of:
 *   - the ordering seam, part (a) of _includes/activity.liquid (#163's
 *     balance policy goes there);
 *   - the Release branch of the render loop: the summary guard, `| escape`,
 *     or the override lookup;
 *   - the shape of _data/activity.json or _data/release_summaries.yml;
 *   - the Jekyll, Liquid or jekyll-scholar gems (the summary guard's
 *     `!= blank` relies on a `blank?` that Liquid 4.0.4 does not define; the
 *     csl gem, pulled in by jekyll-scholar, supplies it), or the plugins that
 *     load ActiveSupport (see EXPECTED_ORDER).
 *
 *   node bin/activity-fixture-check.js
 *
 * Options:
 *   --src <dir>     site source to copy   (default: this repo's working tree)
 *   --vendor <dir>  gem dir for the build (default: /tmp/al-folio-vendor)
 *   --keep          keep the built copy and print its path. It contains
 *                   root-owned files: delete it from a container.
 *
 * It copies the working tree, not HEAD, so an uncommitted template edit is
 * what gets checked. The copy includes assets/libs/, so a run needs the
 * network only when those have not been downloaded yet. Needs Docker; uses the
 * same pinned image and gem dir as the build in CLAUDE.md.
 *
 * Exit status: 0 every assertion passed; 1 an assertion failed (each failure
 * is printed with its name); 2 setup or build failure, with the end of the
 * build log. Exit 2 says nothing about the template's behavior.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const IMAGE = "amirpourmand/al-folio:v0.14.6";
const FIXTURE = path.join(__dirname, "fixtures", "activity");
// Top-level entries never copied: VCS and build state, and local tooling.
const SKIP = new Set([".git", "_site", ".jekyll-cache", ".jekyll-metadata", "node_modules", ".claude"]);

// The rows /activity/ must show for the fixture, newest first. A release is
// "<repo> <tag>"; a post is its title; a note is its text.
//
// The three rows dated 2026-03-10 test cross-source ordering. Post and note
// dates are Ruby Times and release dates are ISO strings. Jekyll 4.4.1's
// `sort: 'date'` compares the two with `Time#<=>`. In this build that is
// ActiveSupport's, which parses the string, so a plain sort orders the mix
// correctly and the seam is not what this case tests today (#168). Without
// ActiveSupport, `Time#<=>` returns nil and Jekyll compares the values as
// text: "2026-03-10 16:00:00 +0000" < "2026-03-10T12:00:00Z", because " "
// sorts before "T", which puts the release above the 16:00 note. So this case
// fails if the seam misorders the three, or if a plain sort is used in a build
// without ActiveSupport; it does not fail for a plain sort in this build.
const EXPECTED_ORDER = [
  "post: Fixture post, newest row",
  "release: fixture-a v1.0.0",
  "release: fixture-a v0.9.0",
  "release: fixture-a v0.8.0",
  "release: fixture-b v0.7.0",
  "release: fixture-b v0.6.0",
  "release: fixture-b v0.5.0",
  "note: Fixture note, same day, after the release.",
  "release: fixture-c v0.4.0",
  "post: Fixture post, same day, before the release",
  "release: fixture-c v0.3.0",
  "release: fixture-c v0.2.0",
  "release: fixture-c v0.1.0",
  "release: Fixture-D V1.0.0",
  "note: Fixture note, oldest row.",
];

// Expected inner HTML of <p class="activity-summary"> per release, exactly as
// it appears in the built page; null means the row must have no summary
// element (tag alone). `escape` writes &quot; and &#39;, but the
// jekyll-link-attributes plugin then re-parses every page with Nokogiri and
// re-serializes it, which writes quotes in element text as plain characters.
// That is harmless in text, so the expectations below show plain quotes and
// still require <, > and & escaped.
const EXPECTED_SUMMARY = {
  "fixture-a v1.0.0": "Control release with a plain summary",
  "fixture-a v0.9.0": "a &lt; b &amp; \"c\" 'd' &lt;script&gt;x&lt;/script&gt; &lt;b&gt;bold&lt;/b&gt;",
  // A literal "&amp;" in the source: `escape` renders &amp;amp;, `escape_once` would render &amp;.
  "fixture-a v0.8.0": "Fish &amp;amp; chips",
  "fixture-b v0.7.0": null, // null summary, no override: the tag alone
  "fixture-b v0.6.0": "Override on a release whose derived summary is null",
  "fixture-b v0.5.0": null, // empty-string summary: no empty <p>
  "fixture-c v0.4.0": "Same-day release, between the note and the post",
  "fixture-c v0.3.0": "&lt;i&gt;override&lt;/i&gt; &amp; &lt;script&gt;y&lt;/script&gt;",
  "fixture-c v0.2.0": "Derived summary kept under an empty override",
  "fixture-c v0.1.0": "Derived summary kept under a whitespace override",
  "Fixture-D V1.0.0": "Override matched case-insensitively",
};

// Raw fixture markup that must never reach either page unescaped.
const RAW_MARKERS = ["<script>x", "<b>bold", "<script>y", "<i>override"];

function parseArgs(argv) {
  const opts = { src: path.resolve(__dirname, ".."), vendor: "/tmp/al-folio-vendor", keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--src") opts.src = path.resolve(argv[++i]);
    else if (a === "--vendor") opts.vendor = path.resolve(argv[++i]);
    else if (a === "--keep") opts.keep = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

function docker(args) {
  return spawnSync("docker", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

// Copy the source tree, then replace its releases, overrides, posts and notes
// with the fixture's.
function stage(src, site) {
  fs.cpSync(src, site, {
    recursive: true,
    filter: (p) => {
      const rel = path.relative(src, p);
      return rel === "" || !SKIP.has(rel.split(path.sep)[0]);
    },
  });
  for (const dir of ["_posts", "_news"]) {
    fs.rmSync(path.join(site, dir), { recursive: true, force: true });
    fs.cpSync(path.join(FIXTURE, dir), path.join(site, dir), { recursive: true });
  }
  for (const f of fs.readdirSync(path.join(FIXTURE, "_data"))) {
    fs.copyFileSync(path.join(FIXTURE, "_data", f), path.join(site, "_data", f));
  }
}

function build(site, vendor) {
  fs.mkdirSync(vendor, { recursive: true });
  // TZ=UTC: _config.yml sets no `timezone:`, so Time#to_s follows the build's
  // zone. The same-day rows only test the seam when the 16:00Z note stays on
  // 2026-03-10; at +09:00 it moves to the next day and a mixed sort would pass.
  const r = docker([
    "run",
    "--rm",
    "-e",
    "TZ=UTC",
    "-e",
    "BUNDLE_PATH=/vendor",
    "-e",
    "JEKYLL_ENV=development",
    "-v",
    `${site}:/srv/jekyll`,
    "-v",
    `${vendor}:/vendor`,
    IMAGE,
    "sh",
    "-c",
    "bundle install --quiet && bundle exec jekyll build",
  ]);
  return r;
}

// The build writes root-owned files all over the copy (_site, caches, any
// fetched libraries), so remove the copy from inside a container.
function cleanup(tmp) {
  const r = docker(["run", "--rm", "-v", `${tmp}:/w`, IMAGE, "rm", "-rf", "/w/site"]);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    console.error(`warning: could not remove ${tmp}: ${e.message}`);
  }
  if (r.status !== 0) console.error(`warning: container cleanup of ${tmp} failed: ${(r.stderr || "").trim()}`);
}

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
const squash = (s) => s.replace(/\s+/g, " ").trim();

// One entry per rendered row: its type, identity and the row's HTML.
function rows(html) {
  const chunks = html.split('<li class="activity-item activity-item--').slice(1);
  return chunks.map((c) => {
    const type = c.match(/^(\w+)"/)[1];
    const body = c.slice(0, c.indexOf("</li>"));
    let name;
    if (type === "release") {
      const a = body.match(/class="activity-title"[^>]*>([\s\S]*?)<span class="sr-only">/);
      name = a ? squash(decode(a[1])) : "?";
    } else if (type === "note") {
      const p = body.match(/<p class="activity-note">([\s\S]*?)<\/p>/);
      name = p ? squash(decode(p[1].replace(/<[^>]+>/g, ""))) : "?";
    } else {
      const a = body.match(/class="activity-title"[^>]*>([\s\S]*?)<\/a>/);
      name = a ? squash(decode(a[1].replace(/<[^>]+>/g, ""))) : "?";
    }
    const dt = body.match(/datetime="([^"]+)"/);
    return { type, name, id: `${type}: ${name}`, datetime: dt ? dt[1] : null, body };
  });
}

function aboutLimit(site) {
  const fm = fs.readFileSync(path.join(site, "_pages", "about.md"), "utf8").split(/^---$/m)[1] || "";
  const m = fm.match(/^activity:\s*\n(?:[ \t]+.*\n)*?[ \t]+limit:\s*(\d+)/m);
  return m ? Number(m[1]) : null;
}

function check(site) {
  const failures = [];
  const ok = (name, cond, detail) => {
    console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : `\n     ${detail}`}`);
    if (!cond) failures.push(name);
  };

  const activityHtml = fs.readFileSync(path.join(site, "_site", "activity", "index.html"), "utf8");
  const aboutHtml = fs.readFileSync(path.join(site, "_site", "index.html"), "utf8");
  const all = rows(activityHtml);

  // Ordering.
  const got = all.map((r) => r.id);
  const firstDiff = got.findIndex((id, i) => id !== EXPECTED_ORDER[i]);
  ok(
    "order: rows match the expected sequence",
    got.length === EXPECTED_ORDER.length && firstDiff === -1,
    `got ${got.length} rows; first difference at row ${firstDiff}: got "${got[firstDiff]}", want "${EXPECTED_ORDER[firstDiff]}"`
  );
  const times = all.map((r) => Date.parse(r.datetime));
  const bad = times.findIndex((t, i) => i > 0 && !(times[i - 1] >= t));
  ok("order: datetimes never increase", bad === -1, `row ${bad}: ${all[bad - 1]?.datetime} then ${all[bad]?.datetime}`);
  const sameDay = [
    "note: Fixture note, same day, after the release.",
    "release: fixture-c v0.4.0",
    "post: Fixture post, same day, before the release",
  ];
  const at = got.indexOf(sameDay[0]);
  ok(
    "order: same-day note > release > post (mixed-type sort)",
    at !== -1 && sameDay.every((id, k) => got[at + k] === id),
    `got ${JSON.stringify(got.slice(at, at + 3))}`
  );

  // Summaries: escaping, null and empty summaries, overrides.
  for (const [rel, want] of Object.entries(EXPECTED_SUMMARY)) {
    const row = all.find((r) => r.type === "release" && r.name === rel);
    if (!row) {
      ok(`summary: ${rel} row present`, false, "row not rendered");
      continue;
    }
    const p = row.body.match(/<p class="activity-summary">([\s\S]*?)<\/p>/);
    if (want === null)
      ok(`summary: ${rel} shows the tag alone`, !/activity-summary/.test(row.body), `row has ${p ? p[0] : "an activity-summary element"}`);
    else
      ok(
        `summary: ${rel} renders exactly`,
        p && p[1] === want,
        `got ${p ? JSON.stringify(p[1]) : "no summary element"}, want ${JSON.stringify(want)}`
      );
  }
  for (const [page, html] of [
    ["/activity/", activityHtml],
    ["about", aboutHtml],
  ]) {
    ok(
      `escape: no raw fixture markup on ${page}`,
      RAW_MARKERS.every((m) => !html.includes(m)),
      RAW_MARKERS.filter((m) => html.includes(m)).join(", ")
    );
    ok(`summary: no empty summary element on ${page}`, !/<p class="activity-summary">\s*<\/p>/.test(html));
  }

  // About page: the first N rows of the full stream.
  const limit = aboutLimit(site);
  if (limit === null) throw new Error("could not read activity.limit from _pages/about.md front matter");
  if (limit >= EXPECTED_ORDER.length)
    throw new Error(`activity.limit ${limit} is not below the fixture's ${EXPECTED_ORDER.length} rows; extend the fixture`);
  const about = rows(aboutHtml).map((r) => r.id);
  ok(`about: first ${limit} rows of /activity/`, JSON.stringify(about) === JSON.stringify(got.slice(0, limit)), `got ${JSON.stringify(about)}`);

  return failures;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "activity-fixture-"));
  const site = path.join(tmp, "site");
  try {
    stage(opts.src, site);
    console.log(`building ${opts.src} with the fixture in ${site} ...`);
    const r = build(site, opts.vendor);
    if (r.error || r.status !== 0) {
      const log = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-40).join("\n");
      console.error(`build failed (${r.error ? r.error.message : `exit ${r.status}`}); last lines:\n${log}`);
      return 2;
    }
    let failures;
    try {
      failures = check(site);
    } catch (e) {
      console.error(`setup error: ${e.message}`);
      return 2;
    }
    console.log(failures.length ? `\n${failures.length} assertion(s) failed` : "\nall assertions passed");
    return failures.length ? 1 : 0;
  } catch (e) {
    console.error(`setup error: ${e.message}`);
    return 2;
  } finally {
    if (opts.keep) console.log(`kept ${site}`);
    else cleanup(tmp);
  }
}

process.exitCode = main();
