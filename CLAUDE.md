# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Frederick Douglas Pearce's personal site — a Jekyll build of the
[al-folio](https://github.com/alshedivat/al-folio) academic theme (Bootstrap 4 + SCSS,
kramdown, Liquid), deployed to GitHub Pages from `main` by `.github/workflows/deploy.yml`.

Because it is a theme fork, most files are upstream. Local divergences are the interesting
part, and they are documented in comments at the point of divergence — read the header
comment of a `_includes/*.liquid`, a workflow, or a `_config.yml` block before changing it.
Several of those comments record a decision _not_ to do the obvious thing (see the removed
"Update \_config.yml" step in `deploy.yml`, the missing scroll container in
`activity.liquid`). Don't undo them without reading why.

## Build and dev commands

**Local `bundle install` on the host does not work** (host Ruby is far newer than
`Gemfile.lock` allows, and the pinned `amirpourmand/al-folio:v0.14.6` image has gems older
than the lockfile). Build through Docker with gems installed into a scratch dir:

```bash
SCRATCH=/tmp/al-folio-vendor && mkdir -p "$SCRATCH"
docker run --rm -v "$PWD":/srv/jekyll -v "$SCRATCH":/vendor \
  -e BUNDLE_PATH=/vendor -e JEKYLL_ENV=development \
  amirpourmand/al-folio:v0.14.6 bundle install

# build (clean first — from *inside* the container; `_site/` and `.jekyll-cache/` are
# root-owned by earlier container runs, so a host-side `rm -rf` fails file-by-file)
docker run --rm -v "$PWD":/srv/jekyll -v "$SCRATCH":/vendor \
  -e BUNDLE_PATH=/vendor -e JEKYLL_ENV=development \
  amirpourmand/al-folio:v0.14.6 \
  sh -c 'rm -rf /srv/jekyll/_site && bundle exec jekyll build'
```

Run as root (do not pass `-u`). To view the result, serve `_site/` with
`python3 -m http.server` and screenshot it. `docker-compose up` (port 8080, livereload) is
the upstream path but hits the same stale-image problem.

Production build, as CI runs it: `JEKYLL_ENV=production bundle exec jekyll build`, then
`purgecss -c purgecss.config.js`. Requires `imagemagick` and `nbconvert` on PATH.

There are no unit tests. Verification is: Prettier, a successful build, and — for
theme/template work — the accessibility audit below.

## Prettier is a gating check on every push

`.github/workflows/prettier.yml` runs `npx prettier . --check` on **push to main as well as
on PRs**, so a formatting miss turns `main` red, not just a PR. Always run before pushing:

```bash
npm ci                    # install the pinned formatter, do not `npm install`
npx prettier . --check
npx prettier . --write
```

The pin (`prettier` + `@shopify/prettier-plugin-liquid` in `package.json`) is exact on
purpose: the upstream repos that publish posts here run the _same_ pinned gate, and a
caret range lets them drift and pass upstream while failing here. If you bump the pin,
bump it in `claude-code-sessions` and `us-presidential-vote-analysis` too, and in
`claude-code-loop` once its publishing pipeline (claude-code-loop#177) exists.

`.prettierignore` excludes vendored/minified assets and the two generated data files,
`_data/esg_news.json` and `_data/repository_stats.json` — see below.

## Content comes from three places, and two of them are not this repo

1. **`_posts/` is written by external syncs**, not authored here. Commits are titled
   `chore(sync): publish posts from <repo>@<sha>`, from `claude-code-sessions` and
   `us-presidential-vote-analysis`, with `claude-code-loop` to follow (claude-code-loop#177).
   Post bodies are copied byte-for-byte, so **editing a post here is reverted on the next
   sync** — fix it upstream. All publishers write into the same `_posts/` namespace and
   cannot see each other; slug collisions are prevented only by operator convention.
2. **`_data/esg_news.json` is pushed by an external cron** (~14:01 UTC daily), feeding
   `/esg-news/`. It is machine-generated, nobody hand-formats it, and it is in
   `.prettierignore` because a change in either the generator's or Prettier's JSON
   serialization would otherwise fail the check on `main` every morning.
3. **Everything else** — `_pages/`, `_news/`, `_projects/`, `_books/`,
   `_bibliography/papers.bib`, `_sass/`, `_includes/` — is authored here normally.
   The exception is `_data/repository_stats.json`, which is generated here by
   `bin/repo-stats.js` from the curated `github_repos` and `github_users` lists and the
   `repo_language_overrides` map in `_data/repositories.yml`. Never hand-edit it: after
   changing either list or the override map, re-run the script (it validates the map too)
   and commit the data file along with `repositories.yml` if the run rewrote it. Don't
   leave that to the weekly refresh (`.github/workflows/repo-stats.yml`, which runs
   `bin/repo-stats-refresh.sh`, commits as `github-actions` and dispatches the deploy):
   until it runs, a new repo's card has no data. It is in `.prettierignore` because its
   layout is `JSON.stringify`'s, not Prettier's.

## Blog taxonomy: `categories` means _series_

One category per publishing repo (`claude-code-sessions`, `us-presidential-vote`,
`claude-code-loop`); kind of post and subject live on **tags**. The chips on `/blog/` are
`display_categories` in `_config.yml`, so that list _is_ the series filter —
`jekyll-archives` generates `/blog/category/<name>/` with no custom code.

Add a new series to `display_categories` **before** its first post syncs. The chip loop in
`_pages/blog.md` renders only categories that have posts, so an early entry stays hidden
and the chip appears on the build that publishes the first post. Adding it afterwards
leaves a window where the series is live with no chip, and nothing reports that: a post
with an unlisted category builds and publishes normally. (Before #100 the loop rendered
every entry, so listing early linked to an archive page Jekyll never generated. That is
why older notes say to add the entry after the sync.)

The blog's name and subheading (`Ground Truth` / "What the source data actually says.")
live in **two** places that must change together: `blog_description` in `_config.yml` (the
visible `<h2>`) and `description` in `_pages/blog.md` (meta/OG/JSON-LD).

## Marketing and social drafts

Links to this site posted anywhere off-site carry UTM parameters. The taxonomy — the
closed `utm_source`/`utm_medium` vocabularies, per-post `utm_campaign` keying, and the
standing-placement table — lives in [`doc/utm-conventions.md`](doc/utm-conventions.md),
which is the single source of truth.

The `marketer` subagent that drafts the LinkedIn/X/dev.to posts is defined at
`~/.claude/agents/marketer.md` — **user-global, outside this repo, shared with other
projects** — so it carries only a generic "apply the convention the site documents" rule
and none of the values above. **Any delegation to it must name `doc/utm-conventions.md`
in the prompt**, or it has no way to find them. Tagging is a one-way door: a link posted
untagged cannot be attributed after the fact.

Share-card images come from `og_image:` front matter (an absolute URL), else the site
banner. Post cards are rendered upstream with the post. Project cards are rendered here by
`bin/og-project-cards.js` from each `_projects/*.md` front matter; re-run it after
changing a project's `title`, `description` or `img`, and add `og_image:` to a new
project. `og_card_img:` overrides `img` on the card only, for an image that doesn't read
at 1200×630. Social platforms cache a card per URL, so fix a card _before_ the link is
first posted.

## Activity stream

`_includes/activity.liquid` renders one merged, typed, reverse-chronological stream of
`site.posts` + `site.news` ("notes"). It is used on `/activity/` (full) and on the about
page (`activity.limit` in `_pages/about.md` front matter). The include is deliberately in
two parts — an ordering seam that produces `activity_items`, and a render loop with one
branch per type. Keep sorting and limiting out of the render loop.

The `news` collection keeps its internal name (`site.news`, read by the templates and the
search index) but is user-facing as Activity, permalinked under `/activity/`.

## Navigation

The navbar is generated in `_includes/header.liquid` from pages with `nav: true`, ordered by
`nav_order`. `_pages/more.md` is a nav-only page: `layout: none`, empty body, `dropdown:
true`, and a `children:` list of literal permalinks — it renders nothing and exists solely
to declare the dropdown. Child pages therefore carry no `nav:` of their own, and
`_scripts/search.liquid.js` falls back to the target page's own `description` for them.

## Jekyll gotchas that fail silently

- **Per-collection `defaults:` is inert.** A `defaults:` key nested under a collection in
  `_config.yml` is ignored; collections honor only `output` and `permalink`. Front-matter
  defaults for a collection must go in the **top-level** `defaults:` block with
  `scope: {path: "", type: <label>}`. The symptom of getting this wrong is a document
  rendering with no layout and appearing in `sitemap.xml` despite `sitemap: false` — with
  no build-time warning.
- **Half of `/assets/js/` is generated, and its source is `_scripts/`.** Those files carry
  front matter with a `permalink:` under `/assets/js/`, and `include: ["_pages", "_scripts"]`
  in `_config.yml` is what publishes them — so a template referencing
  `/assets/js/foo-setup.js` can be perfectly correct with nothing of that name in
  `assets/js/`. Check the built `_site/assets/js/` or `_scripts/`, not the source
  `assets/js/`, before concluding a reference is dead. Getting this backwards produced a
  phantom "these three analytics blocks 404" finding that reached three issue bodies (#86).
- `_plugins/*.rb` are local Ruby plugins (cache-busting, third-party CDN vendoring,
  citation fetching, `{% details %}`). `download-3rd-party.rb` fetches the libraries listed
  in `_config.yml` into `assets/libs/` at build time, so a first build needs network.

## Accessibility

`doc/a11y-baseline.md` records the site-wide audit and its remediation history. Two tools,
both run on demand and deliberately **not** in CI:

```bash
npm install --no-save playwright axe-core   # deps are ad hoc so `npm ci` stays small
node bin/a11y-audit.js                      # axe over every sitemap URL, light + dark
node bin/contrast-sweep.js                  # regenerate _sass/_syntax.scss overrides
```

`a11y-audit.js` audits the **deployed** site by default; pass `--site` to point it at a
local server. Always audit both themes — dark mode was 2.8× worse than light in the first
run, so a single-theme check misses most problems. Note axe cannot see collapsed or
unrendered content (dropdowns, modals), so those need manual checking.

`contrast-sweep.js` exists so the vendored pygments themes under `assets/css/` stay
byte-identical to upstream: it reads them and writes only the failing colors as overrides
into `_sass/_syntax.scss`. Re-run it after updating either vendored theme; don't edit the
vendored files.

## Git: `main` lives in a sibling worktree

This directory is in **detached HEAD** and is routinely behind `origin/main`;
`main` is checked out in the sibling `…-feed` worktree (owned by the ESG feed cron).
`git checkout main` here fails. To commit:

```bash
git checkout -b <topic> origin/main   # untracked files carry over
git add … && git commit
git push origin HEAD:main
```

Do not commit onto the detached HEAD — its parent is stale and the push is rejected as
non-fast-forward. Run `git worktree list` before assuming which branch is where. Leave the
`-feed` worktree alone.

## Deploy

Push to `main` (path-filtered) → build job → `deploy` job publishing to Pages, serialized on
a `pages` concurrency group that never cancels in flight. The daily ESG feed push has an
effective ~14:01 UTC SLA, which is why the timeouts and the concurrency group are tuned the
way the comments in `deploy.yml` describe — recompute the job `timeout-minutes` if you
change a per-attempt cap, a backoff or the landed check.

A failed publish is retried at the same commit first and under a new one only after that
(#131). The job makes up to three attempts, 30s and then 60s apart, each capped at 6 min.
That recovered 3 of the 4 hangs on record. If all three fail, the job checks the live
`/build-version.txt` stamp (a canceled deployment can still finish). If the build isn't
there, the job fails and the `redeploy` job (`bin/pages-redeploy.sh`) takes over. Pages
names each deployment after the commit SHA, and on 2026-11-05 every attempt and a rerun 3.5 h
later kept getting the canceled one back. So `redeploy` pushes an empty commit, dispatches a
fresh deploy with `fallback=true`, and opens a `deploy-fallback` issue that @-mentions the
owner. The fallback run's `report` job comments the result there and closes the issue on
success. The label is load-bearing: `report` finds the issue by it. An open
`deploy-fallback` issue means the site may still be stale. Recover by hand the same way:
branch off `origin/main`, `git commit --allow-empty`, `git push origin HEAD:main`, then
`gh workflow run deploy.yml --ref main`. The dispatch is needed because an empty commit
doesn't match the `paths:` filter. **Rerunning the failed run does not help.** The `drill`
dispatch input exercises the whole path, and its procedure is in the comment on that input.
Run it only off-hours.

An in-Actions push using the default `GITHUB_TOKEN` does **not** trigger `deploy.yml`;
a workflow that commits content must dispatch the deploy explicitly.
`.github/workflows/schedule-posts.txt` (disabled — note the `.txt` extension) has this
latent bug. `bin/repo-stats-refresh.sh` (run by `repo-stats.yml`) and `bin/pages-redeploy.sh`
(the `redeploy` job) do the dispatch through the shared functions in `bin/push-dispatch.sh`:
push, then `gh workflow run deploy.yml --ref main` with `actions: write`. A new committing
workflow should use them too.

## Issue tracking

Epics are plain issues that reference separate child issues by number — GitHub's native
sub-issue feature is not used. Specs for in-flight epics live in `.claude/specs/`.
