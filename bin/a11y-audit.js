#!/usr/bin/env node
/**
 * Site-wide accessibility audit.
 *
 * Drives axe-core through Playwright over every URL in the sitemap, once per
 * theme, and writes a JSON baseline plus a summary table. Run it on demand
 * after theme or template changes — it is deliberately not wired into CI, see
 * the "Should this go in CI?" note in doc/a11y-baseline.md.
 *
 * Deps are installed ad hoc rather than declared in package.json, so that the
 * prettier workflow's `npm ci` stays small:
 *
 *   npm install --no-save playwright axe-core
 *   node bin/a11y-audit.js
 *
 * Options:
 *   --site <url>     site root to audit  (default: the production site)
 *   --out <path>     baseline JSON path  (default: a11y-baseline.json)
 *   --themes a,b     themes to run       (default: light,dark)
 *   --chrome <path>  browser executable  (default: autodetected)
 *
 * Audits the *deployed* site by default: no Ruby toolchain, and it checks the
 * HTML users actually receive. Point --site at a local `jekyll serve` to test
 * unpublished changes.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

// WCAG 2.0/2.1/2.2 A and AA, plus axe's own best-practice rules. The
// best-practice set is not a conformance requirement but catches real
// structural problems (heading order, landmark nesting) worth knowing about.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

// Chrome ships on most dev machines; using it avoids the browser-version
// pinning that made the old axe.yml workflow brittle.
const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function parseArgs(argv) {
  const opts = {
    site: "https://frederick-douglas-pearce.github.io/",
    out: "a11y-baseline.json",
    themes: ["light", "dark"],
    chrome: null,
  };
  for (let i = 2; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--site") opts.site = value.endsWith("/") ? value : value + "/";
    else if (flag === "--out") opts.out = value;
    else if (flag === "--themes") opts.themes = value.split(",");
    else if (flag === "--chrome") opts.chrome = value;
    else throw new Error(`unknown option: ${flag}`);
  }
  return opts;
}

function findChrome(explicit) {
  if (explicit) return explicit;
  const found = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  // Falling through to null lets Playwright use its own bundled browser, which
  // works only if `npx playwright install chromium` has been run.
  return found || null;
}

async function fetchSitemap(site) {
  const res = await fetch(new URL("sitemap.xml", site));
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (urls.length === 0) throw new Error("sitemap.xml contained no <loc> entries");
  return urls.sort();
}

async function auditTheme(browser, theme, urls, site) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Establish the origin first, then pin the theme the way assets/js/theme.js
  // does — it reads localStorage "theme" on load — so every later navigation
  // renders in it.
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);

  const results = [];
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      const applied = await page.getAttribute("html", "data-theme");
      await page.addScriptTag({ content: AXE_SRC });
      const r = await page.evaluate(async (tags) => await window.axe.run(document, { runOnly: { type: "tag", values: tags } }), TAGS);
      results.push({
        url,
        theme,
        applied,
        violations: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          tags: v.tags,
          nodes: v.nodes.map((n) => ({
            target: n.target.join(" "),
            html: n.html.slice(0, 300),
            summary: (n.failureSummary || "").slice(0, 500),
          })),
        })),
        incomplete: r.incomplete.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length })),
        passCount: r.passes.length,
      });
      const n = r.violations.reduce((a, v) => a + v.nodes.length, 0);
      console.log(`[${theme}] ${n === 0 ? "  ok" : String(n).padStart(4)}  ${url}`);
    } catch (e) {
      console.log(`[${theme}]  ERR  ${url} :: ${e.message.split("\n")[0]}`);
      results.push({ url, theme, error: e.message.split("\n")[0] });
    }
  }
  await ctx.close();
  return results;
}

function summarize(all) {
  const rules = {};
  let total = 0;
  const perTheme = {};
  for (const p of all) {
    if (!p.violations) continue;
    perTheme[p.theme] = perTheme[p.theme] || 0;
    for (const v of p.violations) {
      rules[v.id] = rules[v.id] || { impact: v.impact, nodes: 0, pages: new Set() };
      rules[v.id].nodes += v.nodes.length;
      rules[v.id].pages.add(p.url);
      total += v.nodes.length;
      perTheme[p.theme] += v.nodes.length;
    }
  }

  const rank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  console.log("\nIMPACT      NODES  PAGES  RULE");
  Object.entries(rules)
    .sort((a, b) => (rank[a[1].impact] ?? 9) - (rank[b[1].impact] ?? 9) || b[1].nodes - a[1].nodes)
    .forEach(([id, r]) => console.log(`${(r.impact || "?").padEnd(10)} ${String(r.nodes).padStart(6)} ${String(r.pages.size).padStart(6)}  ${id}`));

  console.log(`\ntotal violations: ${total}`);
  Object.entries(perTheme).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
}

(async () => {
  const opts = parseArgs(process.argv);
  const urls = await fetchSitemap(opts.site);
  console.log(`auditing ${urls.length} pages × ${opts.themes.length} themes against ${opts.site}\n`);

  const executablePath = findChrome(opts.chrome);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  const all = [];
  for (const theme of opts.themes) {
    all.push(...(await auditTheme(browser, theme, urls, opts.site)));
  }
  await browser.close();

  fs.writeFileSync(path.resolve(opts.out), JSON.stringify(all, null, 2));
  summarize(all);
  console.log(`\nwrote ${opts.out} (${all.length} page-runs)`);

  // Exit non-zero only on harness failure, never on findings: this is a
  // reporting tool, not a gate. See doc/a11y-baseline.md.
  const errors = all.filter((p) => p.error).length;
  if (errors) {
    console.error(`\n${errors} page(s) failed to load`);
    process.exit(1);
  }
})();
