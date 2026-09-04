#!/usr/bin/env node
/**
 * Screenshot the Sustainability Scorecard from the ESG news page.
 *
 * Produces the images used as the project tile on the about page, as the
 * README screenshot in the classifier repo, and — with --frame scorecard — as
 * the lead image for a scorecard round-up post.
 *
 * Deps are installed ad hoc rather than declared in package.json, so that the
 * prettier workflow's `npm ci` stays small:
 *
 *   npm install --no-save playwright
 *   node bin/scorecard-shot.js --out scorecard.png
 *
 * Options:
 *   --site <url>     page to capture      (default: the production ESG news page)
 *   --out <path>     output PNG path      (default: scorecard.png)
 *   --frame <name>   what to include      (default: full)
 *                      full       scorecard + filter panel + first feed card
 *                      scorecard  the scorecard alone
 *   --theme <name>   light | dark         (default: dark)
 *   --width <px>     viewport width       (default: 1280)
 *   --pad <px>       margin around the clip (default: 6)
 *   --chrome <path>  browser executable   (default: autodetected)
 *
 * Captures the *deployed* page by default, so it needs no Ruby toolchain and
 * shows what readers actually see. Point --site at a local `jekyll serve` to
 * capture unpublished changes.
 *
 * The clip is derived from the live DOM on every run, never hardcoded. Pixel
 * coordinates would still "work" after a layout change — they would just crop
 * the wrong region, and a silently wrong image is worse than a failure. Every
 * element this depends on is asserted, so a renamed selector stops the run.
 *
 * Deliberately not scheduled. The scorecard is a rolling 14-day window, so a
 * given day's capture may be thin or dominated by one story. The summary line
 * printed at the end reports the window and article count — read it before
 * publishing the image.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FRAMES = ["full", "scorecard"];

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
    site: "https://frederick-douglas-pearce.github.io/esg-news/",
    out: "scorecard.png",
    frame: "full",
    theme: "dark",
    width: 1280,
    pad: 6,
    chrome: null,
  };
  for (let i = 2; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--site") opts.site = value;
    else if (flag === "--out") opts.out = value;
    else if (flag === "--frame") opts.frame = value;
    else if (flag === "--theme") opts.theme = value;
    else if (flag === "--width") opts.width = Number(value);
    else if (flag === "--pad") opts.pad = Number(value);
    else if (flag === "--chrome") opts.chrome = value;
    else throw new Error(`unknown option: ${flag}`);
  }
  if (!FRAMES.includes(opts.frame)) throw new Error(`--frame must be one of: ${FRAMES.join(", ")}`);
  if (!["light", "dark"].includes(opts.theme)) throw new Error("--theme must be light or dark");
  if (!Number.isFinite(opts.width) || opts.width < 320) throw new Error("--width must be a number >= 320");
  if (!Number.isFinite(opts.pad) || opts.pad < 0) throw new Error("--pad must be a number >= 0");
  return opts;
}

function findChrome(explicit) {
  if (explicit) return explicit;
  const found = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  // Falling through to null lets Playwright use its own bundled browser, which
  // works only if `npx playwright install chromium` has been run.
  return found || null;
}

/**
 * Measure the region to capture, in page coordinates.
 *
 * Returns { box, footerHeight, caption } or { error }. Callers treat an error
 * as fatal — a missing selector means the page changed shape and the resulting
 * crop would be meaningless.
 */
async function measure(page, frame) {
  return page.evaluate((frame) => {
    window.scrollTo(0, 0);
    const rect = (el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    };

    const scorecard = document.getElementById("scorecard-section");
    if (!scorecard) return { error: "#scorecard-section not found" };
    const box = rect(scorecard);

    if (frame === "full") {
      const sidebar = document.querySelector(".esg-news-sidebar");
      const card = document.querySelector("#articlesContainer > *");
      if (!sidebar) return { error: ".esg-news-sidebar not found" };
      if (!card) return { error: "#articlesContainer rendered no cards" };
      // The filter panel runs far longer than one card, so the card's bottom
      // edge sets the crop and the brand list is cut mid-scroll. That is the
      // intended composition, not an accident of where the fold landed.
      box.left = Math.min(box.left, rect(sidebar).left);
      box.right = Math.max(box.right, rect(card).right);
      box.bottom = rect(card).bottom;
    }

    // The site footer is position:fixed, so it floats over whatever sits at the
    // bottom of the viewport. Its height is what the viewport must clear.
    const footer = document.querySelector("footer");
    const footerHeight = footer && getComputedStyle(footer).position === "fixed" ? footer.getBoundingClientRect().height : 0;

    const caption = document.querySelector("#scorecard-section p");
    return { box, footerHeight, caption: caption ? caption.textContent.trim() : "" };
  }, frame);
}

function clipFrom(box, pad) {
  return {
    x: Math.max(0, Math.round(box.left - pad)),
    y: Math.max(0, Math.round(box.top - pad)),
    width: Math.round(box.right - box.left + pad * 2),
    height: Math.round(box.bottom - box.top + pad * 2),
  };
}

(async () => {
  const opts = parseArgs(process.argv);

  const executablePath = findChrome(opts.chrome);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const ctx = await browser.newContext({ viewport: { width: opts.width, height: 1200 } });
  const page = await ctx.newPage();

  try {
    await page.goto(opts.site, { waitUntil: "domcontentloaded", timeout: 45000 });

    // The scorecard and feed are rendered client-side from _data/esg_news.json,
    // so domcontentloaded is not enough — wait for real content.
    try {
      await page.waitForFunction(
        (frame) => {
          const sc = document.getElementById("scorecard-section");
          if (!sc || sc.getBoundingClientRect().height === 0) return false;
          if (frame !== "full") return true;
          const card = document.querySelector("#articlesContainer > *");
          return !!card && card.getBoundingClientRect().height > 0;
        },
        opts.frame,
        { timeout: 30000 }
      );
    } catch {
      // Nearly always the wrong --site (the project page links to the feed but
      // does not host it), or a feed export that produced no articles.
      throw new Error(`no rendered scorecard at ${opts.site} after 30s — is that the page hosting the feed?`);
    }

    // assets/js/theme.js resolves data-theme to a concrete light/dark value on
    // load, so setting the attribute after load is enough. a11y-audit.js writes
    // localStorage instead because it needs the theme to survive navigation;
    // here there is only one page, and not writing storage keeps the run from
    // leaving a theme preference behind in the browser profile.
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), opts.theme);
    const applied = await page.getAttribute("html", "data-theme");
    if (applied !== opts.theme) throw new Error(`theme did not apply: wanted ${opts.theme}, got ${applied}`);

    const first = await measure(page, opts.frame);
    if (first.error) throw new Error(first.error);

    // Playwright clips a viewport screenshot to the viewport, and the fixed
    // footer overlays its bottom edge. Grow the viewport past both, then
    // re-measure: taller viewports can reflow lazily-sized content.
    const needed = clipFrom(first.box, opts.pad);
    await page.setViewportSize({ width: opts.width, height: needed.y + needed.height + first.footerHeight + 40 });

    const final = await measure(page, opts.frame);
    if (final.error) throw new Error(final.error);
    const clip = clipFrom(final.box, opts.pad);

    const out = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, clip });

    console.log(`wrote ${opts.out}  ${clip.width}x${clip.height}  frame=${opts.frame} theme=${opts.theme}`);
    if (final.caption) console.log(`\n  ${final.caption}\n`);
    console.log("Check that window before publishing — a thin or single-story window makes a poor lead image.");
  } finally {
    await ctx.close();
    await browser.close();
  }
})().catch((e) => {
  console.error(`scorecard-shot: ${e.message.split("\n")[0]}`);
  process.exit(1);
});
