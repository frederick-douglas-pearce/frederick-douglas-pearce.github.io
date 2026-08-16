# Accessibility baseline

First site-wide audit, **16 Aug 2026**, against the live site at commit `0a8bca1`.
axe-core via Playwright, every URL in `sitemap.xml`, in both themes, against
WCAG 2.0/2.1/2.2 A + AA plus axe's best-practice rules.

Regenerate with [`bin/a11y-audit.js`](../bin/a11y-audit.js).

## Headline

|                            |                               |
| -------------------------- | ----------------------------- |
| Pages                      | 40                            |
| Page runs                  | 80 (each page × light + dark) |
| Violations                 | 2,303                         |
| Distinct rules             | 11                            |
| Pages with zero violations | 0                             |

Two things matter more than the raw count.

**Two SCSS variables cause 69% of it.** Of 2,303 violations, 1,710 are colour
contrast, and those collapse onto a handful of colour values repeated across
thousands of elements. `$cyan-color` and `$grey-color` in
`_sass/_variables.scss` account for roughly two-thirds of every contrast
failure on the site.

**Dark mode is 2.8× worse than light** — 1,702 violations against 601.
Auditing only the default theme would have missed most of the problem. Any
future run should keep checking both.

## Contrast failures by colour pair

| Nodes | Share | Pair                         |     Ratio | Needs | Where                                   |
| ----: | ----: | ---------------------------- | --------: | ----: | --------------------------------------- |
|   869 |   51% | `#2698ba` on `#2c3237`       |      3.88 |   4.5 | `$cyan-color`, inline code, dark        |
|   160 |    9% | `#828282` on `#ffffff`       |      3.84 |   4.5 | `$grey-color`, light                    |
|   156 |    9% | `#828282` on `#1c1c1d`       |      4.43 |   4.5 | `$grey-color`, dark                     |
|    46 |    3% | `#ffffff` on `#4285f4`       |      3.56 |   4.5 | badge / button fill                     |
|    41 |    2% | `#999988` on `#fbf3fb`       |      2.65 |   4.5 | pygments comments, light                |
|    30 |    2% | `#ffffff` on `#00c851`       |      2.23 |   4.5 | "open access" badge — worst on the site |
|  ~180 |   10% | pygments tokens on `#404040` | 2.15–4.19 |   4.5 | syntax theme, dark                      |

### `$grey-color` needs two values, not one

It is used for post bylines, tag rows and Font Awesome icons on 38 pages, and
it currently misses in **both** themes. It cannot be fixed with a single value —
the two thresholds pull in opposite directions:

| Value               | on `#ffffff` (light) | on `#1c1c1d` (dark) |
| ------------------- | -------------------: | ------------------: |
| `#828282` (current) |               3.84 ✗ |              4.43 ✗ |
| `#8a8a8a`           |               3.45 ✗ |              4.93 ✓ |
| `#707070`           |               4.95 ✓ |              3.44 ✗ |

Lightening it to pass on dark makes light worse, and vice versa. The fix is to
split it per theme in `_themes.scss` — roughly `#707070` light, `#8a8a8a` dark.

## All rules that fired

Node counts are light + dark combined; page counts are distinct URLs.

| Impact   | Rule                           | Nodes | Pages | Meaning                                                    |
| -------- | ------------------------------ | ----: | ----: | ---------------------------------------------------------- |
| critical | `aria-valid-attr-value`        |     2 |     1 | `aria-disabled="1"` in blog pagination; must be `"true"`   |
| serious  | `color-contrast`               | 1,710 |    19 | Text below 4.5:1 against its background                    |
| serious  | `link-in-text-block`           |   359 |    36 | Inline links distinguished by colour alone                 |
| serious  | `listitem`                     |    90 |     9 | `<li>` with no list parent — template bug, below           |
| serious  | `scrollable-region-focusable`  |    30 |     4 | Scrolling code blocks unreachable by keyboard              |
| serious  | `list`                         |     4 |     2 | `<p>` as a direct child of `<ul>` in blog tag rows         |
| serious  | `link-name`                    |     2 |     1 | Icon-only résumé PDF link on `/cv/` has no accessible name |
| moderate | `landmark-banner-is-top-level` |    76 |    38 | Header landmark nested inside another landmark             |
| moderate | `heading-order`                |    26 |     7 | Heading levels skipped                                     |
| moderate | `landmark-unique`              |     2 |     1 | Two unlabelled `nav` landmarks on `/cv/`                   |
| minor    | `empty-table-header`           |     2 |     1 | `<th>&nbsp;</th>` in a post table                          |

`heading-order` hits all five project pages plus `/cv/` and `/esg-news/`.

## A genuine markup bug

`_includes/related_posts.liquid` opens and closes an empty list _before_ the
loop that emits its items:

```text
<ul class="list-disc pl-8"></ul>    <- opened and closed, empty
...
{% endunless %}
<li class="my-2">...</li>           <- outside any list
```

Every "Enjoy Reading This Article?" block on all nine posts ships orphaned
`<li>` elements, so a screen reader announces loose text instead of "list,
3 items". Straight from al-folio upstream, unmodified.

Note also that the include is full of Tailwind class names (`text-pink-700`,
`list-disc`, `text-3xl`) and this site ships no Tailwind, so none of them
do anything.

## Should this run in CI?

**No — run it on demand.** Three reasons a blocking gate is the wrong shape:

1. **It starts red.** Gating on 2,303 existing violations is useless until they
   are suppressed, and maintaining a suppression baseline is its own recurring
   chore.
2. **Most findings don't track content.** Roughly 85% are theme CSS and
   template markup inherited from al-folio. They don't change when a post is
   published, so re-checking them on every push buys nothing.
3. **Green would be a false signal.** Automated tooling catches roughly a third
   of real accessibility problems. A passing badge invites you to stop looking.

What _does_ track content is small and stable: `heading-order` when adding a
project page, `empty-table-header` and keyboard-reachable code blocks when
writing a post with heavy tables. Those are worth a manual run, not a gate.

If a CI check is ever wanted, gate on **regression against this baseline**
rather than absolute zero — that catches "did I make it worse?" without
requiring 2,303 inherited problems be fixed first.

## Caveats

- axe-core finds a minority of real accessibility problems. A clean run is not
  a claim of conformance; it means the automatically-detectable checks passed.
- The audit reads the deployed site, so it reflects the last successful deploy,
  not the working tree. Point `--site` at a local `jekyll serve` to check
  unpublished changes.
- `landmark-banner-is-top-level` (76 nodes, every page) is an al-folio
  structural choice, not a per-page defect. It is one fix in the layout, or a
  deliberate accept.
