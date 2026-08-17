#!/usr/bin/env node
/**
 * Regenerate _sass/_syntax.scss from the vendored pygments themes.
 *
 *   node bin/contrast-sweep.js
 *
 * Both themes under assets/css/ ship token colours that fail WCAG 4.5:1
 * against their own code background. Rather than edit the vendored files —
 * which would make them undiffable against upstream — this reads them, finds
 * every failing colour, and writes an override partial that re-states only
 * those.
 *
 * Replacements keep the original hue and saturation and move only lightness,
 * in 0.5% steps, until the colour clears 4.6:1 (a little margin over the
 * threshold). That keeps each theme's character intact.
 *
 * Run this after updating either vendored theme, then rebuild. No deps.
 */
const fs = require("fs");
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const rgb2hex = (r) =>
  "#" +
  r
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
const lum = (rgb) => {
  const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a, b) => {
  const [x, y] = [lum(hex2rgb(a)), lum(hex2rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
function rgb2hsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hsl2rgb([h, s, l]) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function fix(hex, bg, target, dir) {
  let [h, s, l] = rgb2hsl(hex2rgb(hex));
  for (let i = 0; i <= 200; i++) {
    const c = rgb2hex(hsl2rgb([h, s, Math.max(0, Math.min(1, l + dir * i * 0.005))]));
    if (cr(c, bg) >= target) return c;
  }
  return dir > 0 ? "#ffffff" : "#000000";
}

const files = [
  { path: "assets/css/jekyll-pygments-themes-github.css", bg: "#f3f8f9", dir: -1, theme: "light", label: "github" },
  { path: "assets/css/jekyll-pygments-themes-native.css", bg: "#404040", dir: +1, theme: "dark", label: "native" },
];
let out = `// Syntax highlighting contrast overrides
//
// The two pygments themes are vendored verbatim under assets/css/ and both
// ship token colours that fail 4.5:1 against their own code background —
// 9 of 22 colours in the light theme, 11 of 19 in the dark one. They are not
// edited in place so that they stay diffable against upstream; this file
// re-states only the failing colours.
//
// Each replacement keeps the original hue and saturation and moves only
// lightness, until the token clears 4.6:1 (a little margin over the 4.5
// threshold). The themes therefore keep their character — greens stay green,
// comments stay grey — they just become readable.
//
// Selectors are prefixed with html[data-theme=...] for two reasons: the dark
// pygments stylesheet is linked *after* main.css, so a bare .highlight .c
// would lose on source order; and each theme's fixes must apply only to its
// own background. assets/js/theme.js always resolves data-theme to a concrete
// light/dark value, so this is reliable.
//
// Regenerate the values with the contrast sweep noted in doc/a11y-baseline.md
// if either vendored theme is ever updated.
`;
for (const f of files) {
  const css = fs.readFileSync(f.path, "utf8");
  const groups = new Map();
  const re = /\.highlight\s+(\.[\w.-]+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const cm = /(?:^|[^-])color:\s*(#[0-9a-fA-F]{6})/.exec(m[2]);
    if (!cm) continue;
    const ownBg = /background-color:\s*(#[0-9a-fA-F]{6})/.exec(m[2]);
    const key = cm[1].toLowerCase() + "|" + (ownBg ? ownBg[1].toLowerCase() : "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m[1]);
  }
  const rows = [];
  for (const [key, sels] of groups) {
    const [c, ob] = key.split("|");
    const bg = ob || f.bg;
    const dir = ob ? (lum(hex2rgb(ob)) > 0.5 ? -1 : +1) : f.dir;
    const r = cr(c, bg);
    if (r >= 4.5) continue;
    rows.push({ c, bg, sels: [...new Set(sels)].sort(), from: r, to: fix(c, bg, 4.6, dir) });
  }
  rows.sort((a, b) => a.from - b.from);
  out += `\n// ${f.theme} theme — ${f.label}.css, code background ${f.bg}\n`;
  out += `html[data-theme="${f.theme}"] .highlight {\n`;
  out += rows
    .map(
      (row) =>
        `  // ${row.c} -> ${row.to}   ${row.from.toFixed(2)} -> ${cr(row.to, row.bg).toFixed(2)}${row.bg !== f.bg ? " on " + row.bg : ""}\n` +
        row.sels.map((s) => `  ${s}`).join(",\n") +
        ` {\n    color: ${row.to};\n  }\n`
    )
    .join("\n");
  out += `}\n`;
}
fs.writeFileSync("_sass/_syntax.scss", out);
console.log("wrote _sass/_syntax.scss");
