# Activity stream epic — FILED as #66 (issues #67–#75)

> **⚠️ READ [REVISION 2](#revision-2--architect-review-incorporated) FIRST (bottom of file).**
> An architect review verified every claim in this draft against the codebase. It found one
> outright factual error, two unflagged side-effects, and three issue-scope gaps, and it
> resolved two of the six open questions. Revision 2 is **authoritative** wherever it
> conflicts with the body below. The body is kept as-written for the audit trail.

Epic + separate issues for restoring and extending the al-folio "news" feature as a
merged **Activity stream** at `/activity/`. Phased **Option C (MVP) → Option D (goal)**.

House style: separate issues that *reference* the epic; the epic body lists them as a
checklist of `#NN`. Filed 2026-08-18: epic #66, issues #67–#75. Placeholders have been resolved to real numbers. Nothing here uses GitHub's native
sub-issue feature.

Suggested labels: reuse `enhancement`, `accessibility`; create a new `activity` label
(mirrors the `repositories` label from #54) so the stream work is filterable.

---

# EPIC BODY (paste target)

## Epic: merge posts + news into a typed Activity stream at `/activity/`

Tracking issue for restoring al-folio's dormant `news` feature as a single **typed
Activity stream**, and extending it to auto-pull GitHub Releases.

The work is split across nine independent issues — **#67, #68, #69, #70, #71** (Phase C, the
MVP) and **#73, #74, #75, #72** (Phase D, the goal) — each closable on its own. This epic
holds the shared context and the order to work them in; it stays open until they are all
resolved.

This body is written to be **self-contained** — enough to pick the work up cold, without
the conversation that produced it.

---

## Where this came from

al-folio ships a `news`/announcements feature: a short reverse-chronological stream of
one-line updates, rendered on the about page and on a standalone page. On this site it
was half-disabled and left orphaned:

- `_includes/news.liquid` and `_includes/latest_posts.liquid` are both present, nearly
  identical to upstream.
- `_layouts/about.liquid` already has both blocks in the right spot, gated on
  `page.announcements.enabled` / `page.latest_posts.enabled` — **both currently `false`**.
- `_pages/news.md` exists (`permalink: /news/`, no `nav:`), so `/news/` **builds, sits in
  `sitemap.xml`, renders "No news so far…", and has zero inbound links.**
- `_news/` exists but is **empty**.
- The real off-switch: `collections.news` was **removed from `_config.yml`** in
  `10182f9`. Only `projects: {output: true}` remains. Upstream had
  `news: {defaults: {layout: post}, output: true}`.

Two adjacent capabilities are also dormant but intact:

- **The navbar dropdown is fully wired and was never removed.** `_includes/header.liquid`
  has the complete `p.dropdown` branch (children loop, `divider` support, active-state
  propagation to the parent). `_sass/_base.scss:327-344` styles it.
  `bootstrap.bundle.min.js` (incl. Popper) loads at `_includes/scripts.liquid:9`. Only the
  example page `_pages/dropdown.md` was deleted (`39e7b94`).
- `_posts/` already holds a real content stream: 9 posts (2026-05-26 → 2026-08-06) across
  two series. **Posts sync byte-for-byte from external repos** (`claude-code-sessions`,
  `us-presidential-vote-analysis`); the site repo **must not edit `_posts/` content.**

So nothing here is a rewrite. Phase C **re-activates** dormant al-folio machinery and
merges the two existing content sources (`site.posts` + `_news`) into one typed stream.
Phase D adds a third, auto-pulled source (GitHub Releases).

## Decisions already made (do not relitigate)

1. **Name/URL** is `/activity/`. The orphan `/news/` page is retired/redirected. The
   `_news` collection name stays internally because the template expects it.
2. **Navbar:** no top-level slot for activity. Restore al-folio's dropdown and group
   **publications + repositories + activity** under it. Rationale: the navbar is at 5
   items and a **consulting tab** is planned that needs prominent real estate. Moving 2
   items under a 1-slot dropdown and adding consulting nets back to 5 top-level.
3. **Release rows** show the tag **and** a one-line summary.
4. **Backfill** the stream with historical events.
5. **Placement:** below the bio on the about page (the block is already in the right spot).
6. **Phasing:** Option C is the MVP (merge `site.posts` + `_news`), Option D is the goal
   (add GitHub Releases as a third source).

## Critical finding — the release-summary plan as originally conceived does not work

The original plan was "hand-write a good first line in the release notes moving forward."
**That is not viable as things stand.** Both `codefluent` and `agentfluent` generate
release notes automatically via **release-please**, so the body is machine-written from
conventional commits and any hand-edit is regenerated on the next release. Verified:

- `agentfluent v0.11.0` first line is a compare-link heading
  (`## [0.11.0](…/compare/v0.10.0...v0.11.0) (2026-07-22)`) — useless as a summary.
- `codefluent v1.2.0` first line is `## What's Changed` (GitHub auto-changelog) — also
  useless.
- The 16 historical releases needed for the backfill have **no** hand-written summary line.

Two mechanics replace it, and they compose (both are specced in Phase D):

- **(a) Derive it** — take the first bullet under `### Features`, strip the trailing
  `([#NNN](url))` / `([sha](url))` link noise. Verified good output: `agentfluent v0.11.0`
  yields *"analyze: show an SDK-vs-Claude-Code indicator."* Handles the backfill with zero
  hand-writing. Needs a fallback for releases with no `### Features` section and for
  codefluent's `## What's Changed` format.
- **(b) Manual override** — `_data/release_summaries.yml` keyed by `repo@tag`, hand-written
  one-liners that win over the derived value. Decouples from release-please and lets Fred
  polish the few that matter.

**(a) is the default, (b) is the override.** This also means the release backfill is
**automatic**: the Releases API returns all historical releases, so #73's fetch backfills
the 16 minor+ releases with no hand-authoring. The only hand-written backfill is
non-release **milestones**, which are seeded as `_news` items in Phase C (see #71).

## Hard constraints and known traps (baked into the issues below)

- **No external API calls at build time.** `jekyll-get-json` accepts URLs, but this exact
  pattern already burned the site: `/repositories/` cards died when github-readme-stats
  returned 503 (epic #54). The about page is the highest-traffic URL and must not depend on
  a third party's uptime. **Required pattern: a scheduled GitHub Actions workflow fetches
  the API and commits `_data/activity.json`; the build reads only the local file.** Same
  precedent as `_data/esg_news.json` (external cron, `.prettierignore`d).
- **A workflow pushing `_data/` with the default `GITHUB_TOKEN` will NOT trigger
  `deploy.yml`**, even though `_data/**` is in its `paths:` filter — GitHub suppresses
  workflow-triggered workflow runs. It needs an explicit `workflow_dispatch`. The **same
  latent bug already exists in `.github/workflows/schedule-posts.txt`**; fix both together
  (#72).
- **Accessibility — this repo closed a 2303→0 audit (epic #46); regressions are not
  acceptable.** The dormant includes carry latent defects that must be fixed as part of
  restoring them:
  - The upstream scroll container `<div class="table-responsive" style="max-height:60vw">`
    has **no `tabindex="0"`** → WCAG 2.1.1 "scrollable region must have keyboard access."
    Latent in **both** `news.liquid` and `latest_posts.liquid`.
  - Upstream uses a layout `<table>` for what is semantically a list. It has
    `<th scope="row">` for the date so it is not an outright violation, but a `<dl>`/list is
    more honest and degrades far better on mobile than a fixed 20%/80% table.
  - `header.liquid` **hardcodes `id="navbarDropdown"`** rather than deriving it per-page →
    a second dropdown would emit a duplicate ID (axe violation). Only one dropdown is
    planned now, but fix it as part of restoring the feature.
  - Dark mode has **4 distinct surfaces** in this codebase; any new component needs all four.
- **Stream balance.** Projected steady-state is ~5–6 posts/month (Fred plans to add
  CodeFluent, AgentFluent, possibly ESG series to the current 2), ~2.7 minor+ releases/month,
  ~1–2 hand-written/month. A naive `sort: date | reverse` makes the stream ~60% blog — a
  worse duplicate of `/blog/`, which already has series filters. **Phase D needs per-source
  caps/floors or interleaving, not a plain date sort** (#75). Deferred to D because that is
  the phase where a third source actually exists.
- **Release filtering: minor-or-greater only.** Verified last-6-month volume: agentfluent
  12 (v0.1.0→v0.11.0), codefluent 9 (v0.2.0→v1.2.1) = 21 total, **16 minor+**. Patches
  (`v0.5.1`, `v1.2.1`, `v0.2.1`, `v0.2.2`, `v1.0.1`) are noise. Only `codefluent` and
  `agentfluent` publish releases; `claude-code-sessions` and `us-presidential-vote-analysis`
  publish none.

## Issue list

Phase C (MVP — merge the two existing sources):
- [ ] #67 — Restore the `_news` collection and stand up the `/activity/` page (retire `/news/`)
- [ ] #68 — Restore the navbar dropdown; group publications + repositories + activity; fix the duplicate-ID trap
- [ ] #69 — Build the merged, typed Activity stream include (a11y-correct)
- [ ] #70 — Wire the stream into the about page below the bio and enable it
- [ ] #71 — Backfill hand-written historical milestones as `_news` entries

Phase D (goal — add GitHub Releases as a third source):
- [ ] #73 — Scheduled workflow: fetch + filter + derive release summaries → commit `_data/activity.json`
- [ ] #74 — Manual override file `_data/release_summaries.yml` (`repo@tag` → one-liner)
- [ ] #75 — Integrate releases as the third source with interleaving / per-source caps
- [ ] #72 — Fix the `GITHUB_TOKEN`-won't-trigger-deploy bug (activity workflow + `schedule-posts.txt`)

## Priority order

The MVP is **#67 → #68/#69 in parallel → #70 → #71**. Ship Phase C before starting D.

| Order | Issue | Phase | Why here |
| --- | --- | --- | --- |
| 1 | #67 | C | Foundation — re-adds the collection and the page. Nothing else renders without it. |
| 2 | #69 | C | The visible deliverable: the merged typed stream. Can be built in parallel with #68. |
| 3 | #68 | C | Restores nav access + frees navbar room for the planned consulting tab. Parallel with #69. |
| 4 | #70 | C | Turns the stream on where it matters (about page, below bio). Needs #69. |
| 5 | #71 | C | Seeds hand-written milestones so the stream isn't empty on launch. Needs #67. |
| 6 | #72 | D | Unblocks correct auto-deploy for #73 and fixes an existing latent bug. Do before/with #73. |
| 7 | #73 | D | The Releases data pipeline — the whole point of Phase D. |
| 8 | #74 | D | Override layer on top of #73's schema. Small. |
| 9 | #75 | D | Merges releases into the stream with balance logic. Needs #73 + #69. |

## Out of scope

- **Editing `_posts/` content.** Posts sync byte-for-byte from external repos; the stream
  reads them, never writes them.
- **`latest_posts.liquid`.** The merged stream supersedes it. Leave `latest_posts.enabled:
  false`; do not wire it into the about page in parallel. (Its latent `tabindex` defect is
  noted for whenever it is finally deleted, but deletion is not in this epic.)
- **Hand-authoring release summaries upstream.** Not viable under release-please (see
  above). Replaced by derive-with-override (#73/#74).
- **Sources beyond posts / news / releases.** No stars, commits, PR/issue activity, or
  social feeds. The stream is intentionally editorial + release-driven.
- **Interleaving logic in Phase C.** With only two sources and a small backlog, plain date
  sort is fine for the MVP; the balance problem only bites once releases land (#75).

## Acceptance criteria — epic done

- [ ] `/activity/` renders a single reverse-chronological stream merging blog posts,
      hand-written notes, and (post-D) minor+ GitHub Releases, each row visibly typed.
- [ ] The stream also renders below the bio on the about page.
- [ ] `/news/` no longer serves a dead page — it redirects to `/activity/` (or is removed
      and out of `sitemap.xml`), with no orphan left behind.
- [ ] Publications, repositories, and activity are reachable from a single navbar dropdown;
      no duplicate `navbarDropdown` id; top-level navbar is back to 5 slots with room for
      the consulting tab.
- [ ] Release rows show tag + a one-line summary; summaries derive automatically and can be
      overridden per `repo@tag`; only minor+ releases appear.
- [ ] Release data is fetched by a scheduled workflow into `_data/activity.json`; a failed
      refresh never blanks the about page; the commit correctly triggers a deploy.
- [ ] No build-time external API call anywhere in the render path.
- [ ] The about page and `/activity/` do not increase axe violations vs the pre-change
      baseline (scroll region keyboard-reachable, all 4 dark surfaces, semantic list markup).

## Open questions for the human (flagged, not silently decided)

1. **Redirect mechanism for `/news/`.** `jekyll-redirect-from` is **not** in the current
   plugin set (`jekyll-get-json`, `jekyll-feed`, `jekyll-sitemap`, `jemoji`,
   `jekyll-archives-v2`). Options: (a) add the plugin, (b) keep `_pages/news.md` as a
   meta-refresh/`<link rel="canonical">` stub pointing at `/activity/`, (c) delete the page
   outright and let the old URL 404. Recommendation: (b) — no new dependency, preserves the
   URL. **Needs a decision in #67.**
2. **Dropdown label.** What is the parent menu called? ("Portfolio", "Work", "More"…) The
   children are publications / repositories / activity. **Needs a decision in #68.**
3. **Does `projects` also move under the dropdown?** The decision names publications +
   repositories + activity. `projects` (nav_order 2) and `repositories` (nav_order 5) are
   distinct top-level items today. If `projects` stays top-level, the post-change navbar is
   blog / projects / cv / [dropdown] / consulting = 5. Confirm `projects` stays out of the
   dropdown.
4. **Type labels + visual treatment.** Proposed row types: **Post**, **Note**, **Release**.
   Confirm the labels and whether type is shown as a text badge, an icon, or a colour. Badge
   colours must come from existing SCSS tokens (no new hardcoded colour — see #53).
5. **Milestone backlog for #71.** #71 needs the actual list of historical milestones to seed
   (what events, what dates, one line each). Fred to supply, or approve a first draft.
6. **#75 balance policy — deferred but will need numbers.** Per-source caps vs floors vs
   interleave, and the actual limits (e.g. "max 3 consecutive posts", "≥1 release visible in
   the top 10"). Not needed until #75; flagging so it isn't forgotten.

---

# ISSUE SPECS (draft bodies — file each as a separate issue referencing the epic)

## #67 — Restore the `_news` collection and stand up `/activity/` (retire `/news/`)

**Phase:** C (MVP). **Size:** S. **Prerequisite for:** #68, #69, #70, #71.

**Problem.** The `news` collection was removed from `_config.yml` in `10182f9`, so `_news/`
is inert and the about-page block has nothing to read. The desired page lives at
`/activity/`, but `_pages/news.md` currently owns `/news/` and renders a dead
"No news so far…" page that sits in `sitemap.xml` with zero inbound links.

**Scope.**
- Re-add the collection to `_config.yml`, keeping the internal name `news` (the template
  expects it): `news: {defaults: {layout: post}, output: true}` (match upstream; confirm the
  `layout` value against what #69's include renders).
- Create `_pages/activity.md` with `permalink: /activity/`, a page title, and the block that
  #69's include will drive. No `nav:` here (nav is handled by the dropdown in #68).
- Retire `/news/`: implement the redirect chosen in Open Question 1.
- Ensure `sitemap.xml` ends up with `/activity/` and does not advertise a dead `/news/`.

**Acceptance criteria.**
- [ ] `_config.yml` declares the `news` collection with `output: true`; a build emits
      `_news` entries.
- [ ] `/activity/` builds and is reachable at that permalink.
- [ ] `/news/` redirects to `/activity/` (or is removed); no "No news so far…" page remains
      live.
- [ ] `sitemap.xml` contains `/activity/` and not a live dead `/news/`.
- [ ] Prettier `--check` passes; `deploy.yml` `paths:` still matches the changed files.

**Dependencies.** None. Blocks #68–#71.

---

## #68 — Restore the navbar dropdown; group publications + repositories + activity; fix the duplicate-ID trap

**Phase:** C (MVP). **Size:** M. **Depends on:** #67 (the `/activity/` page must exist to
link). **Prerequisite for:** none (but part of the MVP definition of done).

**Problem.** The navbar is at 5 items and a consulting tab is planned. al-folio's dropdown
branch is fully wired in `header.liquid` and styled in `_base.scss:327-344`, and Bootstrap +
Popper are already loaded — but the example dropdown page was deleted (`39e7b94`), so nothing
declares a dropdown. Separately, `header.liquid` hardcodes `id="navbarDropdown"`, which would
emit a duplicate ID (axe violation) the moment a second dropdown ever exists.

**Scope.**
- Recreate a dropdown page config (the deleted `_pages/dropdown.md` is the template):
  ```yaml
  layout: page
  title: <parent label — see Open Question 2>
  nav: true
  nav_order: <slot; keep consulting's future slot in mind>
  dropdown: true
  children:
    - title: publications
      permalink: /publications/
    - title: repositories
      permalink: /repositories/
    - title: activity
      permalink: /activity/
  ```
- Remove the top-level `nav`/`nav_order` from the `publications` and `repositories` pages so
  they appear only under the dropdown (confirm they aren't double-listed).
- Fix `header.liquid` to derive the dropdown toggle `id` per page (e.g. from the page slug)
  instead of the hardcoded `navbarDropdown`, so multiple dropdowns stay valid.

**Acceptance criteria.**
- [ ] The navbar shows a single dropdown whose children are publications, repositories,
      activity; each navigates correctly.
- [ ] Active-state propagates to the parent when a child page is current (existing behaviour
      preserved).
- [ ] Top-level navbar is back to 5 slots (blog, projects, cv, dropdown, + room for consulting).
- [ ] The dropdown toggle `id` is unique/derived; view-source shows no duplicate
      `navbarDropdown`; axe shows no duplicate-id violation on any page.
- [ ] Renders correctly in both themes.

**Dependencies.** #67.

---

## #69 — Build the merged, typed Activity stream include (a11y-correct)

**Phase:** C (MVP). **Size:** L. **Depends on:** #67. **Can run in parallel with #68.**

**Problem.** al-folio's `news.liquid` renders only the `_news` collection, as a layout
table, with a keyboard-inaccessible scroll container, and reads `page.announcements.*` where
newer upstream uses `site.announcements.*`. We need one include that merges **`site.posts` +
`_news`** into a single reverse-chronological, **typed** stream, and that clears the latent
a11y defects rather than inheriting them.

**Scope.**
- New include (e.g. `_includes/activity.liquid`) driven from the `/activity/` page and,
  later, the about page. Merge `site.posts` and the `news` collection into one list sorted by
  date descending.
- Each row is **typed**: Post vs Note (Release added in #75). Type shown per Open Question 4,
  using existing SCSS tokens only.
  - Posts link to the post URL and show series/category where available; Notes render their
    one-line body inline. Do not modify `_posts/` content.
- Replace the layout `<table>` with semantic list markup (`<dl>` or `<ul>`) that degrades on
  mobile instead of a fixed 20%/80% table.
- If a scroll container is kept, it must have `tabindex="0"` and an accessible name.
- Style all **4 dark-mode surfaces**; no new hardcoded colours.
- Resolve the `page.announcements.*` vs `site.announcements.*` variable so the enable-gate
  works from the page front matter used in #67/#70.

**Acceptance criteria.**
- [ ] `/activity/` renders a single merged stream of posts + notes, newest first, each row
      visibly typed.
- [ ] Markup is a semantic list, not a layout table; usable on a narrow viewport.
- [ ] Any scroll region is keyboard-focusable (`tabindex="0"`) with an accessible name; axe
      reports no "scrollable region must have keyboard access."
- [ ] Correct in both themes across all 4 dark surfaces; no new hardcoded colours.
- [ ] No build-time external request; reads only local collections/data.
- [ ] axe violations on `/activity/` do not exceed the pre-change baseline.

**Dependencies.** #67. Parallelizable with #68.

---

## #70 — Wire the stream into the about page below the bio and enable it

**Phase:** C (MVP). **Size:** S. **Depends on:** #69 (and #67).

**Problem.** `_layouts/about.liquid` already has the block in the right spot (below the bio),
gated on `page.announcements.enabled` — currently `false`. We need the merged stream (#69),
not the old `news.liquid`, wired there and turned on.

**Scope.**
- Point the about-page block at #69's include and enable it via the about page front matter.
- Keep `latest_posts.enabled: false` — the merged stream supersedes it (do not enable both).
- Decide/confirm how many items show on the about page vs the full `/activity/` page (e.g. a
  top-N on about, full list on `/activity/`).

**Acceptance criteria.**
- [ ] The merged stream renders below the bio on the about page.
- [ ] The old standalone `news.liquid`/`latest_posts.liquid` blocks are not both active; only
      the merged stream shows.
- [ ] About page renders correctly in both themes; axe not worse than baseline.
- [ ] About page makes no build-time external request.

**Dependencies.** #69, #67.

---

## #71 — Backfill hand-written historical milestones as `_news` entries

**Phase:** C (MVP). **Size:** S–M (depends on how many milestones). **Depends on:** #67;
best verified after #69.

**Problem.** On launch the stream should not be empty of editorial content. Historical
**milestones** (non-release events worth noting) need to be seeded as `_news` entries.
**Releases are NOT backfilled here** — #73's fetch pulls all historical releases from the API
automatically; hand-writing them would duplicate and drift.

**Scope.**
- Author `_news/*.md` entries for the agreed milestone list (Open Question 5), one line each,
  correctly dated, using the `news`/`post` layout the collection expects.
- Keep entries short (one-liners) so they read as stream items, not posts.

**Acceptance criteria.**
- [ ] Each agreed milestone appears as a dated Note row in the stream, in correct
      chronological position relative to posts.
- [ ] No release is hand-authored as a Note (avoids duplication with #73).
- [ ] Prettier passes on the new files.

**Dependencies.** #67. Blocked on Open Question 5 (the milestone list) before authoring.

---

## #73 — Scheduled workflow: fetch + filter + derive release summaries → commit `_data/activity.json`

**Phase:** D (goal). **Size:** L. **Depends on:** #72's dispatch pattern. **Prerequisite
for:** #74, #75.

**Problem.** Release rows need tag + summary, from data that must be present locally at build
time (no build-time API calls — the `/repositories/` outage in #54 is the cautionary tale).
release-please makes upstream release bodies machine-written, so summaries must be **derived**
(with a manual override in #74).

**Scope.**
- A scheduled GitHub Actions workflow (mirror the `_data/esg_news.json` external-data
  precedent) that:
  - Fetches Releases for `codefluent` and `agentfluent` from `api.github.com`.
  - Filters to **minor-or-greater** tags (drop patches like `v0.5.1`, `v1.2.1`, `v0.2.1`,
    `v0.2.2`, `v1.0.1`).
  - **Derives** a one-line summary: first bullet under `### Features`, stripping trailing
    `([#NNN](url))` / `([sha](url))` link noise. Fallback for releases with no `### Features`
    section and for codefluent's `## What's Changed` format (e.g. first PR title, or the tag
    alone as last resort).
  - Writes `_data/activity.json` (tag, repo, date, summary, url).
- Make the output **prettier-stable** or add it to `.prettierignore` with an explanatory
  comment — a generated `_data/` file (`esg_news.json`) has broken the prettier `check` job
  before.
- The commit of `_data/activity.json` must **explicitly `workflow_dispatch` the deploy**
  (see #72) — a `GITHUB_TOKEN` push to `_data/**` does not trigger `deploy.yml` on its own.
- **Graceful degradation:** a failed fetch must never blank or shorten the existing
  `activity.json` (keep last-good; stale-but-present beats fresh-but-blank).

**Acceptance criteria.**
- [ ] The workflow produces `_data/activity.json` containing only minor+ releases for the two
      repos, with a derived one-line summary each.
- [ ] Derivation verified on real data: `agentfluent v0.11.0` →
      *"analyze: show an SDK-vs-Claude-Code indicator"*; codefluent's `## What's Changed`
      format produces a sensible fallback, not a raw heading.
- [ ] All ~16 historical minor+ releases are present (automatic backfill).
- [ ] A simulated fetch failure leaves the prior `activity.json` intact.
- [ ] Committing the file triggers a deploy (via explicit dispatch), verified end to end.
- [ ] Prettier `check` passes (file is stable or ignored).

**Dependencies.** #72 (dispatch pattern). Feeds #74, #75.

---

## #74 — Manual override file `_data/release_summaries.yml` (`repo@tag` → one-liner)

**Phase:** D (goal). **Size:** S. **Depends on:** #73 (schema).

**Problem.** Derived summaries are good but not always ideal; some releases deserve a
hand-polished line. release-please prevents editing the upstream body, so the override lives
in the site repo.

**Scope.**
- `_data/release_summaries.yml` keyed by `repo@tag` (e.g. `agentfluent@v0.11.0`).
- The stream/build prefers the override value over the derived value when a key exists.

**Acceptance criteria.**
- [ ] A `repo@tag` entry in `release_summaries.yml` replaces the derived summary for that
      release in the stream.
- [ ] Absence of a key falls back cleanly to the derived summary.
- [ ] Keys are case-consistent with #73's output (guard the case-sensitivity trap that bit
      #54's card lookups).

**Dependencies.** #73.

---

## #75 — Integrate releases as the third source with interleaving / per-source caps

**Phase:** D (goal). **Size:** M. **Depends on:** #73 (data) and #69 (the stream include).

**Problem.** Adding releases makes three sources. At projected volume (~60% posts under naive
date sort) the stream becomes a worse duplicate of `/blog/`. It needs balance logic, not a
plain `sort: date | reverse`.

**Scope.**
- Add Release rows (type = Release) to #69's stream, showing tag + summary (override-aware,
  #74), linking to the release URL.
- Apply the agreed balance policy (Open Question 6): per-source caps/floors or interleaving so
  posts don't crowd out releases and notes.
- Preserve all a11y properties from #69.

**Acceptance criteria.**
- [ ] Release rows appear in the stream, typed, with tag + summary + link.
- [ ] The stream does not degrade to a near-pure blog list; the agreed balance policy is
      applied and visible.
- [ ] Reads only `_data/activity.json` + local collections; no build-time API call.
- [ ] Both themes correct; axe not worse than baseline.

**Dependencies.** #73, #69. Blocked on Open Question 6 (balance numbers) before final tuning.

---

## #72 — Fix the `GITHUB_TOKEN`-won't-trigger-deploy bug (activity workflow + `schedule-posts.txt`)

**Phase:** D (goal). **Size:** S. **Prerequisite for:** #73 (shares the fix).

**Problem.** A workflow that pushes `_data/**` with the default `GITHUB_TOKEN` does **not**
trigger `deploy.yml`, despite `_data/**` being in its `paths:` filter — GitHub suppresses
workflow-triggered workflow runs. This latent bug already exists in
`.github/workflows/schedule-posts.txt`; #73 would reproduce it. It fails **green** (the commit
lands, no deploy runs), so it's easy to miss.

**Scope.**
- Establish the correct pattern: after committing generated `_data/`, explicitly dispatch
  `deploy.yml` (`workflow_dispatch`) — or another mechanism that reliably triggers the deploy.
- Apply it to the new activity workflow (#73) and fix the existing `schedule-posts.txt`.

**Acceptance criteria.**
- [ ] A commit made by the activity workflow triggers a deploy, verified end to end.
- [ ] `schedule-posts.txt` is fixed to trigger a deploy after its commit (or explicitly
      documented as intentionally manual).
- [ ] The pattern is documented inline so future data-committing workflows don't re-introduce
      the bug.

**Dependencies.** None. Should land before/with #73.

---
---

# REVISION 2 — architect review incorporated

Authoritative over the body above wherever they conflict. Every claim below was verified
against the actual files; `file:line` references are real.

## Decisions now settled (were open questions)

| # | Question | Resolution |
| --- | --- | --- |
| 1 | `/news/` redirect mechanism | **Meta-refresh stub, no plugin.** Confirmed a11y-clean. |
| 2 | Dropdown parent label | **`more`** (lowercase, matches existing nav). |
| — | Note-page indexing (new) | **`sitemap: false`, keep in search.** |
| 3 | Does `projects` move under the dropdown? | **No** — stays top-level. |
| 4 | Type labels | **Post / Note / Release.** Treatment still open (badge vs icon vs colour). |
| 5 | Milestone list for #71 | **Draft below — needs Fred's review.** |
| 6 | #75 balance policy | Still deferred to #75. |

### Why meta-refresh, definitively
Zero-delay meta refresh is **not** a WCAG 2.2.1 violation — SC 2.2.1 fails *timed* refreshes
(technique F41); instant redirects are an accepted technique (H76). And
`jekyll-redirect-from` buys nothing: on GitHub Pages there is no server-side 301, so the
plugin **also** emits a meta-refresh stub. Same mechanism, extra dependency. Hand-roll it.

## Factual error in the body above — delete it

**#69's problem statement is wrong** where it says `news.liquid` "reads `page.announcements.*`
where newer upstream uses `site.announcements.*`." In *this* repo `_includes/news.liquid`
reads **`site.news`** for data (lines 2, 11); only the *config* (`limit`, `scrollable`) reads
`page.announcements.*`, and `_layouts/about.liquid:44` already gates on
`page.announcements.enabled` with the block present at `_pages/about.md:17-21`. There is no
migration to perform. **Strike that line from #69's scope.**

## Verified mechanics (build on these with confidence)

- **The merge works.** `{% assign items = site.posts | concat: site.news | sort: 'date' | reverse %}`
  is valid — both are arrays of Jekyll `Document`s.
- **The type discriminator is `item.collection`**, which exposes the *label string*:
  `"posts"` vs `"news"`. No pre-tagging pass, no `.categories`/`.inline` heuristics. Keep
  `inline` only *within* the Note branch to choose inline-body vs link, as today.
  Smoke-test this one line in a throwaway build before building on it; the fallback if a
  future Jekyll changes the drop is `item.collection.label`.
- **Mixed timezones sort correctly.** Posts carry explicit offsets (`…-0800`), news items use
  `…-0400`; Liquid `sort` compares Ruby `Time` instants. Every item has a date, so no nil-sort
  hazard.
- **`workflow_dispatch` is already declared on `deploy.yml:52`** — #72 has no hidden
  prerequisite.
- **Dropdown children are declared by literal `permalink` strings** (`header.liquid:97`), so
  child pages need no `nav:`. Removing `nav`/`nav_order` from publications/repositories is
  safe and they will not be double-listed (the top-level loop gates on `p.nav`,
  `header.liquid:67`).
- **Search survives the navbar change.** `_scripts/search.liquid.js:21-38` re-adds dropdown
  children under a "Dropdown" section — they move from "Navigation" to "Dropdown", not out.

## Unflagged side-effects — both land in #67

Re-adding the collection with `output: true` makes **every** `_news` item, including inline
one-liners, render a standalone `layout: post` page. Two consequences:

1. **Sitemap leak.** jekyll-sitemap includes every output document not marked
   `sitemap: false`. #71's milestones would each become a thin indexed page.
   **→ Set `sitemap: false` in the collection defaults.**
2. **Search index.** `_scripts/search.liquid.js:81-102` loops `site.collections` generically
   for any label != `posts`, and already handles `item.inline`. Notes enter ninja-keys
   automatically — **desired**, per decision — but the section renders as **"News"**.
   **→ Relabel that section to "Activity".**

Resulting #67 config:
```yaml
collections:
  news:
    output: true
    defaults:
      layout: post
      sitemap: false
  projects:
    output: true
```

**Safe, verified, no action needed:** `jekyll-archives-v2` is scoped to `posts:` only
(`_config.yml:253-259`); `jekyll-feed` needs explicit `feed.collections` to include non-post
collections and doesn't have it; `related_posts` uses `site.related_posts`, posts-only by
construction.

## Issue-scope corrections

### #67 — add three things
- Collection defaults per the block above (`sitemap: false`).
- The meta-refresh stub at `_pages/news.md` **must itself carry `sitemap: false`** — it is a
  live 200 page and would otherwise stay in the sitemap, contradicting this epic's own
  acceptance criterion.
- **`_pages/activity.md` `title:` must be exactly `activity`** (lowercase, case-sensitive).
  #68's active-state propagation compares `page.title == child.title`
  (`header.liquid:71-73, 96`). A capitalised title silently breaks parent highlighting.
  Cross-reference this constraint in both #67 and #68.

### #68 — the duplicate-ID fix is a *pair*, not one attribute
The hardcoded id appears **twice**: `id="navbarDropdown"` (`header.liquid:79`) **and**
`aria-labelledby="navbarDropdown"` (`header.liquid:90`). Deriving the id per page (e.g.
`navbarDropdown-{{ p.title | slugify }}`) is sufficient for uniqueness **only if
`aria-labelledby` uses the identical derived value** — otherwise you trade a duplicate-id
violation for a broken ARIA reference, which is worse.

### #69 — two interface constraints, or #70 and #75 become rewrites
This is the most important structural finding.
1. **Isolate the ordering seam.** Structure the include as (a) build the ordered item list,
   then (b) render each typed row. #75 then swaps only (a) and adds a Release branch to (b).
   **This is what lets #69 ship before the #75 balance policy is decided** — the unknown policy
   plugs into a known seam.
2. **#69 owns the `limit` param**, not #70. Today's `news.liquid` already has this shape
   (`include.limit` + `page.announcements.limit`). #70 then merely supplies `limit=5` on about
   and nothing on `/activity/`. If #70 has to add the param later, that's an interface change
   across two issues.

Note the composition: when #75's per-source caps and #70's top-N both exist, they compose (cap
per source, *then* take N). That composition lives in the single ordering seam.

**Re-size #69 upward.** There is **no** `.news`/`.news-title` SCSS anywhere in `_sass/` (only
`.newsletter-*`); the current table rides entirely on Bootstrap table classes. Moving to a
semantic list is **greenfield styling across all 4 dark surfaces**, not a restyle.

### #70 — add the hardcoded-path fix
`_layouts/about.liquid:44-48` hardcodes `/news/` in **both** the heading link and the include
(`{% include news.liquid limit=true %}`). #70 must repoint the include to `activity.liquid`
**and** change the heading href to `/activity/`. Currently unstated.

### #73 — fail-closed on partial failure
"Never blank or shorten" is achievable but not via regenerate-and-commit. Mechanism:
fetch each repo to a temp file (`set -eo pipefail`) → validate it parses as JSON **and** is a
non-empty array (**treat `[]` as failure**, not a legitimate empty result) → only then
overwrite and commit if changed.

The partial-failure case (one repo 200, one 5xx) is where the criterion actually bites:
rebuilding from only the successful repo *drops* the other's releases, which shortens the
file. **Adopt fail-closed** — if either fetch fails validation, write nothing and keep
last-good. At ~2.7 releases/month a one-day-stale stream is a non-event, and per-repo merging
is more code and more ways to get the merge key wrong. **The AC must specify the partial
case**, or it isn't testing the risky path.

### #74 — override resolves at **render time**
`_data/activity.json` holds only the *derived* summary; the stream prefers
`site.data.release_summaries['repo@tag']` at build time when the key exists. Why:
- **Feedback loop.** Editing `release_summaries.yml` is a normal human push to `_data/**`,
  which triggers `deploy.yml` directly. A fetch-time override wouldn't appear until the next
  cron tick.
- **Separation of concerns.** `activity.json` stays a pure derived cache; editorial content
  stays in the repo where it's edited.
- **Failure modes.** A render-time override for a tag absent from `activity.json` (e.g. a
  filtered-out patch) is a harmless no-op; fetch-time would silently drop overrides for
  anything the fetch filtered or missed.

### #72 — three corrections
- **`workflow_dispatch` already exists** (`deploy.yml:52`). No unstated prerequisite.
- **`schedule-posts.txt` is inert** — it is a `.txt`, not a `.yml`, so it is not a live
  workflow. Its default-token `git push` (line 39) *would* hit this bug if activated.
  Dormant, not an active bug. Fine to fix preemptively; describe it accurately.
- **The ESG precedent is a counter-example for triggering, not a model.**
  `_data/esg_news.json` deploys correctly *because* an **external cron** pushes it — a
  non-`GITHUB_TOKEN` actor, which is exactly why it never needed a dispatch. #73 runs *inside*
  Actions with the default token and therefore does. ESG remains a valid precedent for
  **data-locality** (fetch → commit local → build reads local) and for the `.prettierignore`
  treatment. State this explicitly so nobody copies the ESG pattern and is surprised.

**Dispatch vs PAT vs App token:** use **explicit dispatch** (`gh workflow run deploy.yml`
with the in-workflow `GITHUB_TOKEN`) — no new secret, uses existing capability, costs one
extra workflow run. A fine-grained PAT or GitHub App token buys push-native triggering at the
cost of secret rotation / setup; only worth it when consolidating many data-committing
workflows.

## Acceptance criteria to rewrite

- **"sitemap contains `/activity/` and not a live dead `/news/`"** — unsatisfiable by the
  chosen meta-refresh stub unless `sitemap: false` is added. As written the mechanism and the
  AC contradict each other.
- **#73 "a simulated fetch failure leaves the prior `activity.json` intact"** — must specify
  the **partial** failure (one repo down); the all-down case is trivial and misses the risk.
- **"axe violations do not exceed the pre-change baseline" on `/activity/`** — `/activity/`
  is a brand-new URL with no baseline. This can only mean **zero violations on the new page**;
  say that.

## Sequencing verdict

The C→D seam is **correct**, and the dependency graph holds — *conditional on #69's two
interface constraints above*. Without them, #75 and #70 become edits to #69's interface and the
seam leaks. Minor note: #68 technically builds without #67 (a child permalink pointing at a
not-yet-existing page just 404s; the build won't fail), but the given order is cleaner.

## #71 milestone backfill — APPROVED (Fred, 2026-08-18)

Dates from repo creation via the GitHub API. **No release is hand-authored here** — #73
backfills all 16 minor+ releases automatically, so anything pegged to a release tag would
render twice.

| Date | Note |
| --- | --- |
| 2025-12-13 | Started the Sportswear ESG News Classifier — an end-to-end ML pipeline classifying ESG news for 50+ brands. |
| 2026-02-28 | Started CodeFluent, grounded in Anthropic's AI Fluency Research. |
| 2026-04-14 | Started AgentFluent — local-first agent analytics with prompt diagnostics. |
| 2026-05-26 | Launched the *Ground Truth* blog with the Claude Code session-format series. |
| 2026-06-12 | Published claude-code-data-collective — a curated, sanitized public corpus of Claude Code session data. |
| 2026-07-23 | Extracted claude-code-loop from AgentFluent as a reusable Claude Code plugin. |

### Three rows were dropped from the draft, all for the same reason
#73 renders every **minor-or-greater** release, so any milestone pegged to one duplicates it:

- ~~2026-03-09 — CodeFluent's first public release (`v0.2.0`)~~ → #73 renders `codefluent v0.2.0`.
- ~~2026-04-17 — AgentFluent's first public release (`v0.1.0`)~~ → #73 renders `agentfluent v0.1.0`.
- ~~2026-04-29 — CodeFluent reached `v1.0`~~ → #73 renders `codefluent v1.0.0`. **This row was
  also factually wrong**: `v1.0.0` shipped **2026-03-25T09:09:31Z**; 2026-04-29 is `v1.2.0`.

The surviving rows are all repo-creation / launch events, which #73 never emits. **Rule for
future notes: if it has a release tag, let #73 render it — don't write a Note.**

### Excluded by decision (Fred, 2026-08-18)
- **Anthropic AI Fluency Framework certification** — hold until *completed*, then add as a
  Note. Still listed as in-progress in `_pages/about.md`.
- **Talks, Medium articles, Show HN posts, role changes** — none yet. These are the intended
  future content of the manual `_news` lane.

## Open items still needing a decision

- **Type treatment** (Q4): badge / icon / colour for Post · Note · Release. Colours must come
  from existing SCSS tokens — no new hardcoded values (see #53). Candidate for a design pass
  before #69 is built.
- **Milestone list** (Q5): review the draft table above.
- **#75 balance policy** (Q6): per-source caps vs floors vs interleave, and the numbers.
  Not needed until #75.
