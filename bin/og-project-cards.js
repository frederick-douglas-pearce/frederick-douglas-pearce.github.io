#!/usr/bin/env node
/**
 * Render the Open Graph share card for each project page.
 *
 * Reads the front matter of every _projects/*.md and writes a 1200x630 PNG to
 * assets/img/<project>-og.png: the project title and description at the top,
 * the project's own card image (`img`) in a panel below, and the site footer.
 * A project whose `img` doesn't read at 1200x630 (a tall portrait screenshot
 * shrinks to an illegible strip) can set `og_card_img:` to use a different
 * image on its share card only; its project tile keeps `img`.
 * Each page points at its card through `og_image:` front matter, which
 * _includes/metadata.liquid emits as og:image and twitter:image.
 *
 * The chassis copies the blog post cards, which are rendered upstream by
 * claude-code-loop/tooling/render-og-card.py: same background, panel colors,
 * corner radius, type sizes and footer. Change them together, or shared
 * project and post links stop looking like one family.
 *
 * Deps are installed ad hoc rather than declared in package.json, so that the
 * prettier workflow's `npm ci` stays small:
 *
 *   npm install --no-save playwright
 *   node bin/og-project-cards.js
 *
 * Options:
 *   --only <name>    render one project, by filename without .md (default: all)
 *   --chrome <path>  browser executable                         (default: autodetected)
 *
 * The PNGs are committed; nothing renders at build time. Re-run after changing
 * a project's title, description or img, and look at every card before
 * committing: the image is fitted, never cropped, so a tall or narrow image
 * sits small in its panel rather than losing content.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const PROJECTS = path.join(ROOT, "_projects");
const OUT_DIR = path.join(ROOT, "assets/img");

// From render-og-card.py, so the two card families match.
const BG = "#0f0f14";
const PANEL_BG = "#16161d";
const FG = "#ffffff";
const MUTED = "#8a8a99";
const MARK = "#5a5a68";
const SUBHEAD_FG = "#c0c0c8";
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

function parseArgs(argv) {
  const opts = { only: null, chrome: null };
  for (let i = 2; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--only") opts.only = value;
    else if (flag === "--chrome") opts.chrome = value;
    else throw new Error(`unknown option: ${flag}`);
  }
  return opts;
}

function findChrome(explicit) {
  if (explicit) return explicit;
  // Falling through to null lets Playwright use its own bundled browser.
  return CHROME_CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

// Project front matter is flat `key: value` scalars, so a line match is enough
// and avoids a YAML dependency. A key this needs that is missing stops the run.
function frontMatter(file) {
  const src = fs.readFileSync(file, "utf8");
  const block = src.match(/^---\n([\s\S]*?)\n---/);
  if (!block) throw new Error(`${file}: no front matter`);
  const fm = {};
  for (const line of block[1].split("\n")) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  for (const key of ["title", "description", "img"]) {
    if (!fm[key]) throw new Error(`${file}: front matter has no ${key}`);
  }
  return fm;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function cardHtml(fm) {
  const img = fm.og_card_img || fm.img;
  const imgPath = path.join(ROOT, img);
  const mime = MIME[path.extname(imgPath).toLowerCase()];
  if (!mime) throw new Error(`${img}: unsupported image type`);
  const dataUri = `data:${mime};base64,${fs.readFileSync(imgPath).toString("base64")}`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: ${BG}; font-family: ${FONT};
         display: flex; flex-direction: column; overflow: hidden; }
  h1 { color: ${FG}; font-size: 42px; font-weight: 300; text-align: center;
       padding: 32px 40px 0; line-height: 1.15; }
  p.sub { color: ${SUBHEAD_FG}; font-size: 23px; font-weight: 400; text-align: center;
          padding: 10px 80px 0; line-height: 1.3; text-wrap: balance; }
  .panel { flex: 1; min-height: 0; margin: 24px 40px 0; background: ${PANEL_BG};
           border-radius: 14px; padding: 20px; display: flex;
           align-items: center; justify-content: center; }
  .panel img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  footer { height: 58px; display: flex; justify-content: space-between;
           align-items: center; padding: 0 38px; font-weight: 300; }
  .who { color: ${MUTED}; font-size: 20px; }
  .mark { color: ${MARK}; font-size: 18px; }
</style></head><body>
  <h1>${escapeHtml(fm.title)}</h1>
  <p class="sub">${escapeHtml(fm.description)}</p>
  <div class="panel"><img src="${dataUri}" alt=""></div>
  <footer><span class="who">Frederick Pearce · Data. AI. Human.</span><span class="mark">Projects</span></footer>
</body></html>`;
}

(async () => {
  const opts = parseArgs(process.argv);
  const files = fs
    .readdirSync(PROJECTS)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !opts.only || f === `${opts.only}.md`)
    .sort();
  if (files.length === 0) throw new Error(`no project matched ${opts.only}`);

  const executablePath = findChrome(opts.chrome);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  for (const file of files) {
    const name = path.basename(file, ".md");
    const fm = frontMatter(path.join(PROJECTS, file));
    await page.setContent(cardHtml(fm), { waitUntil: "load" });

    // A subhead that wraps past two lines would squeeze the image panel to a
    // sliver, and the card would still render; fail instead.
    const lines = await page.$eval("p.sub", (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    if (lines > 2) throw new Error(`${file}: description wraps to ${lines} lines; shorten it or the card loses its image`);

    const out = path.join(OUT_DIR, `${name}-og.png`);
    await page.screenshot({ path: out, type: "png" });
    console.log(`wrote ${path.relative(ROOT, out)}  (og_image: /assets/img/${name}-og.png)`);
  }
  await browser.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
