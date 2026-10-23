# UTM conventions

Every link to this site that is placed anywhere off-site carries UTM parameters, so that
the traffic it drives is attributable in [Umami](https://umami.is/). This file is the
**source of truth** for the taxonomy. It is site knowledge, not agent knowledge — it
applies to links drafted by the `marketer` subagent and to links placed by hand alike
(GitHub profile, email signature, talk slides, conference bios).

Umami parses `utm_*` parameters out of the landing URL automatically. No site code is
involved, which is why this convention could be — and was — written before any tracking
script existed.

## Why the convention comes first

**Tagging is a one-way door.** A link posted untagged to LinkedIn or dev.to cannot be
corrected after publication: the post can be edited, but everyone who already clicked
arrived unattributed, and that traffic is permanently indistinguishable from direct. The
cost of tagging is a query string; the cost of not tagging is a hole in the record that
no later work can fill.

## The parameters

| Parameter      | Required | Value                                                                    | Notes                                                               |
| -------------- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `utm_source`   | yes      | the platform: `linkedin`, `devto`, `medium`, `x`, `github`, `newsletter` | Closed vocabulary — see below. Add values deliberately, not ad hoc. |
| `utm_medium`   | yes      | `social` for posts; `referral` for a link placed in a profile or bio     | Two values. Resist growing this.                                    |
| `utm_campaign` | yes      | the individual post slug, e.g. `222-votes-away`                          | Keyed per post, not per series — see below.                         |
| `utm_content`  | no       | distinguishes two links to this site within the same post                | Use only when a single post carries more than one link.             |

`utm_term` is unused. It exists for paid-search keywords; nothing here is paid search.

### LinkedIn takes `utm_source` only

Every LinkedIn link carries **one** parameter: `?utm_source=linkedin`. LinkedIn corrupts
the `&` between parameters (see "Verifying a tag landed"), so a link with no `&` is the
only one that survives. This is the single exception to the "Required" column above.

Little is lost. For a post, `utm_campaign` is the post slug, which is the landing page
Umami already records, and `utm_medium` is always `social`. To read a LinkedIn
campaign, filter Umami on source `linkedin` and read the pages. What is lost is
`utm_content`: two links in one LinkedIn post cannot be told apart, so a CV visit from
a LinkedIn post is attributed to LinkedIn but not to the post that drove it. Accept
that rather than build around it.

### `utm_source` — closed vocabulary

| Value        | Where                                                       |
| ------------ | ----------------------------------------------------------- |
| `linkedin`   | LinkedIn posts, comments, and the LinkedIn profile itself   |
| `devto`      | dev.to articles and TIL posts                               |
| `medium`     | Medium articles, including imports of a post from this site |
| `x`          | X / Twitter posts and threads                               |
| `github`     | GitHub profile README, repo READMEs, issue and PR comments  |
| `newsletter` | any email newsletter placement                              |

The vocabulary is closed on purpose. Two spellings of the same platform (`dev.to` and
`devto`, `twitter` and `x`) split one channel into two rows in the dashboard, and nothing
merges them afterward. Adding a genuinely new channel means adding a row to this table in
the same change that first uses it.

### `utm_medium` — two values

- `social` — a **post**: a piece of content published at a point in time that goes stale.
- `referral` — a **standing placement**: a link that sits in a profile, bio, README, or
  signature and keeps sending traffic indefinitely.

The distinction that matters is burst versus trickle, not the platform. A link in a
LinkedIn _post_ is `social`; the same URL in the LinkedIn _profile_ is `referral`.

## `utm_campaign` is keyed on the post, not the series

Decided deliberately; recorded here so it is not revisited.

**Granularity only converts downward.** A set of per-post tags can always be aggregated
into a series total by filtering on a common prefix or by summing the posts in a series.
A series-level tag can never be split back into per-post numbers. Since links are tagged
one at a time either way, the finer grain costs nothing at authoring time and buys a
question that the coarser grain cannot answer.

This deliberately does **not** mirror the blog category taxonomy, where `categories:`
names the publishing series (`claude-code-sessions`, `us-presidential-vote`,
`claude-code-loop`). That asymmetry is intended, not an oversight: categories group posts
for readers, campaigns separate them for measurement.

**Deriving the value.** No post sets a `slug:` override, so the campaign value is exactly
the filename slug — the `_posts/YYYY-MM-DD-<slug>.md` basename with the date prefix
stripped — which is also the last path segment of the permalink (`/blog/:year/:title/`).
Copy it from the URL you are already pasting; do not invent a shortened form.

### Standing placements that are not about one post

A profile or signature link points at the site, not at a post, so there is no slug to
key on. Use a stable placement name instead, and keep it in this table:

| Placement                        | `utm_source` | `utm_medium` | `utm_campaign` |
| -------------------------------- | ------------ | ------------ | -------------- |
| LinkedIn profile "Website" field | `linkedin`   | —            | —              |
| GitHub profile README            | `github`     | `referral`   | `profile`      |
| Email signature                  | `newsletter` | `referral`   | `signature`    |
| Talk slides / speaker bio        | `newsletter` | `referral`   | `talk-<event>` |

The campaign name stays constant for the life of the placement. Re-keying it on a whim
splits one long-running trickle into unrelated rows.

The LinkedIn profile link is `utm_source` only, like every LinkedIn link. It points at
the homepage, which is what separates it from a post's link in Umami.

## Worked examples

**A LinkedIn post about a specific blog post** — source only; the landing page is the
campaign:

```
https://frederick-douglas-pearce.github.io/blog/2026/222-votes-away/?utm_source=linkedin
```

**A dev.to article linking the same series' other post** — full tags, campaign is the
post slug:

```
https://frederick-douglas-pearce.github.io/blog/2026/inside-the-subagent-trace-file/?utm_source=devto&utm_medium=social&utm_campaign=inside-the-subagent-trace-file
```

**An X post that links both the post and the CV** — `utm_content` separates the two
links, which share a campaign because they belong to the same post:

```
https://frederick-douglas-pearce.github.io/blog/2026/what-launched-this-turn/?utm_source=x&utm_medium=social&utm_campaign=what-launched-this-turn&utm_content=post
https://frederick-douglas-pearce.github.io/cv/?utm_source=x&utm_medium=social&utm_campaign=what-launched-this-turn&utm_content=cv
```

On LinkedIn the same two links are both `?utm_source=linkedin`.

**A standing link in the GitHub profile README** — `referral`, placement-keyed campaign:

```
https://frederick-douglas-pearce.github.io/?utm_source=github&utm_medium=referral&utm_campaign=profile
```

### Mechanics

- Parameters go **after** the trailing slash the permalink already has:
  `/blog/2026/222-votes-away/?utm_source=…`, never `/222-votes-away?utm_source=…`.
- All values are **lowercase**. Umami treats `LinkedIn` and `linkedin` as two values.
- Order the parameters `source`, `medium`, `campaign`, `content`. Order is not
  semantically meaningful, but a consistent order makes a wrong tag visible at a glance.
- Tag only links **to this site**. Outbound links to other people's sites get nothing.

## Applying it — two homes, one source of truth

This file is the source of truth. The `marketer` subagent, which drafts the LinkedIn,
X, and dev.to posts, holds only a **generic** rule: _when the target site documents a UTM
convention, apply it; the parent will say where the doc is._ The agent is defined at
`~/.claude/agents/marketer.md` — **user-global, outside this repo, and shared with other
projects** — so this site's vocabulary must not be baked into it, or one project's
taxonomy leaks into every other repo the agent serves.

The consequence for anyone driving that agent: **the delegation prompt must point at this
file by path.** See the "Marketing and social drafts" section of `CLAUDE.md`.

## Verifying a tag landed

Check **every** link, **after** it is published, by clicking it **from the live post** —
not from the draft. A correct draft proves nothing: the first tagged links that reached
Umami (#87, Oct 2026) were drafted correctly and still arrived broken, because the
platform altered them after they were pasted.

The check is the browser's address bar on the page the click lands on. It must show
the full query string, with plain `&` between parameters, every value lowercase, and
nothing missing. Umami cannot serve as the check from your own browser: own-traffic
exclusion (`localStorage` `umami.disabled`, see #83) means your click is never
recorded. If a link is wrong, edit the post at once — every click before the fix is
unattributed.

Failures seen so far, each of which fails silently (the visit is recorded, the
attribution is not):

- **`amp;` in place of `&`** (LinkedIn, Oct 2026, #114). LinkedIn's `lnkd.in` short
  link resolved a correct link to
  `?utm_source=linkedinamp;utm_medium=socialamp;utm_campaign=…`, so Umami recorded one
  garbage `utm_source` with no medium or campaign. LinkedIn does this itself:
  re-pasting the link from plain text into the edited post broke it the same way. That
  is why LinkedIn links carry `utm_source` only (see "LinkedIn takes `utm_source`
  only").
- **A misspelled parameter _name_** (`utm_camapign`). Ignored entirely.

## Out of scope

**Retro-tagging links already published.** Anything posted before this convention landed
is pre-convention. Editing a live post's link does not recover the clicks it already
received, and it makes the post's own history inconsistent for no gain. Note the cut-off
and move on.

This does not cover a **broken** tag on a post made under the convention. Fix that as
soon as it is found (see "Verifying a tag landed"): the post is still collecting clicks,
and every one before the fix is lost.
