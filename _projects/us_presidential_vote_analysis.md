---
layout: page
title: US Presidential Election Analysis
description: A cleanly joined Electoral College and popular-vote record, 1824–2024, served as a public API
img: assets/img/usvote_api_2000.svg
importance: 3
category: work
---

## Overview

Every four years the same argument returns: should the Electoral College decide the presidency, or should the national popular vote? Five times in 47 presidencies the two records disagreed — 1824, 1876, 1888, 2000, 2016 — and the National Popular Vote Interstate Compact now holds [222 of the 270 electoral votes](https://www.nationalpopularvote.com/state-status) it would need to activate without a constitutional amendment.

The argument runs on top of a record that, as far as I've been able to find, has never been assembled publicly in one place a machine can read. The National Archives keeps the Electoral College result; election researchers keep the popular vote separately, in sources with different coverage, different state conventions, and different spellings of the same candidate's name. This project takes those documents, reconciles them onto one shared state-and-candidate model back to **1824**, and publishes the result as a **[free public API](https://api.us-presidential-election-center.org/docs)** — 51 elections, 5,623 state-by-candidate rows, 96 candidates, no key required.

In the spirit of checks and balances, the analysis layer explores a third option alongside the two familiar ones: **the average of the Electoral College and popular-vote outcomes**. How many elections would have flipped, and by how much would the margins move?

<div class="mt-5"></div>

## Three Ways to Pick a Winner

| Method                | How the winner is decided                             | Status                                                        |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| **Electoral College** | A majority of electors _appointed_ — 270 of 538 today | Recorded 1824–2024, live on the public API                    |
| **Popular Vote**      | The national vote count, summed across states         | Recorded 1976–2024 on the public surface (licensing boundary) |
| **Hybrid**            | The average of the two — a more balanced third option | In development — the analysis layer on top of the warehouse   |

<div class="mt-5"></div>

## The Public API

A read-only snapshot of the joined record, live and free to query. Interactive OpenAPI docs carry the endpoint reference, realistic examples, and a data-provenance statement up front.

<a href="https://api.us-presidential-election-center.org/docs" class="btn btn-primary me-2">
  Browse the API Docs
</a>
<a href="https://api.us-presidential-election-center.org/v1/elections/2000/summary" class="btn btn-outline-primary">
  Try a live query
</a>

| Endpoint                       | Returns                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `/v1/elections`                | Every covered year, with candidate count and whether popular vote exists |
| `/v1/elections/{year}`         | Per-state rows for one election, filterable by state                     |
| `/v1/elections/{year}/summary` | The national roll-up — electoral votes, popular votes, who took office   |
| `/v1/states/{usps}`            | One state's record across every election                                 |
| `/v1/candidates/{slug}`        | One candidate's record across every election they contested              |
| `/v1/meta`, `/health`          | Provenance, coverage windows, and the loaded snapshot version            |

Every response ships in a `{data, meta}` envelope, and `meta.provenance` travels with it — source, license, coverage window, snapshot version — so the data's limits can never drift from what was actually built.

<div class="mt-5"></div>

## What the Record Refuses to Assume

Two centuries of American elections were never documented the way a modern one is. What matters more than completeness is whether the record is honest about the difference between _we don't know_ and _the answer is zero_ — and that distinction is designed into the schema rather than left to a footnote.

<div class="row mt-4">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">An empty cell is never bare</h5>
                <p class="card-text mb-0">Every state-year carries a <code>pv_status</code> — <code>popular_vote</code>, <code>legislature_chosen</code>, or <code>not_participating</code>. So 1860 South Carolina (its legislature appointed the electors) and 1860 New York both show a null popular vote, and the two nulls mean different things. The database refuses a fourth "unknown" value, because an unknown bucket is where an unresolved gap sits quietly forever.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Cast and appointed stay two numbers</h5>
                <p class="card-text mb-0">The Twelfth Amendment sets the threshold on electors <em>appointed</em>, not votes <em>cast</em>. In 2000 one DC elector handed in a blank ballot — 537 cast against 538 appointed — and the bar did not move. In 1872 electors cast 300 votes for Grant and Congress counted 286. The API reports both, plus the denominator, rather than collapsing them.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Two sources cover each other</h5>
                <p class="card-text mb-0">In 1864, eleven states took no part. The Archives lists all 36 states with a dash in every column; the popular-vote source lists 25 and explains the rest in a sentence of prose no parser will read. Exactly eleven states hold a zero allotment in the electoral record — which is how the absences in the other source get verified instead of inferred.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Which states belong in the denominator</h5>
                <p class="card-text mb-0">In 1824, six states appointed electors by legislature and held no popular vote at all. Drop them and Jackson holds 99 of 190 — a majority, elected outright. Keep them and it is 99 of 261, no majority, and the House chose Adams. Treating "held no popular vote" as "doesn't count" manufactures a constitutional majority that never existed.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">One person, three correct spellings</h5>
                <p class="card-text mb-0">Bob Dole and Robert Dole; "STROM THURMOND" and J. Strom Thurmond; John C. Fremont and Frémont. Each source is right inside its own document, and none of them agree. A curated per-source reconciliation map onto one canonical name is decided once and reused everywhere, so "how many times has this person run" is answerable at all.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Technical Architecture

The pipeline moves from two incompatible public records to one queryable surface in four stages:

<div class="row mt-4">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Electoral College Ingestion</h5>
                <p class="card-text mb-0">Scrapes every US presidential election from 1824 to the present from the <a href="https://www.archives.gov/electoral-college/results">National Archives</a> into a star-schema warehouse in Postgres — state and candidate dimensions over a votes fact. The two contested Reconstruction elections are modeled rather than smoothed: 1868 carries Georgia's nine disputed electoral votes flagged as <code>disputed</code>, and 1872 synthesizes the cast-then-rejected votes the Archives table omits. An optional local HTML corpus lets the whole spine rebuild with zero network requests.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Popular-Vote Reconciliation</h5>
                <p class="card-text mb-0">Ingests two independent sources — the <a href="https://electionlab.mit.edu/">MIT Election Lab</a> 1976–2024 dataset and the historical <a href="https://www.presidency.ucsb.edu/">UCSB American Presidency Project</a> pages — onto the same candidate and state keys as the electoral spine, behind a shared set of contracts so neither source's quirks leak into the model.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">The Join Seam</h5>
                <p class="card-text mb-0">Two views join the resolved popular vote back onto the electoral spine: one full analysis surface, and one license-clean public subset defined independently as "redistributable only," so non-redistributable rows cannot reach the public artifact by accident. A two-way check on every load asserts that a no-popular-vote state has exactly zero vote rows and a popular-vote state has at least one.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Freeze, Don't Serve</h5>
                <p class="card-text mb-0">A historical dataset doesn't change between elections, so nothing needs to stay running. A build step materializes the public view into an immutable read-only SQLite snapshot; the API imports no database driver at all, enforced by a test. Postgres is the source of truth at build time and stopped at serve time.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Deployment</h5>
                <p class="card-text mb-0">A ~150 MB cloud-agnostic container with the snapshot <em>baked in</em>, so image version equals data version and there is no artifact/code skew. Google Cloud Run scales it to zero and caps it at one instance; Cloudflare fronts it for edge caching, rate limiting, and bot protection. A keyless GitHub Actions deploy purges the edge cache by version after cutover.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Data Provenance and Coverage

Coverage is stated on every response, never inferred from a field of nulls.

| Layer                       | Window        | Source                           | License                                                            |
| --------------------------- | ------------- | -------------------------------- | ------------------------------------------------------------------ |
| **Electoral College**       | **1824–2024** | US National Archives (NARA)      | Public domain, US Government                                       |
| **Popular vote**            | **1976–2024** | MIT Election Lab                 | CC0 1.0                                                            |
| **Historical popular vote** | pre-1976      | UCSB American Presidency Project | Not redistributable — warehouse only, excluded from the public API |

The popular-vote window is a licensing boundary, not a records one. The returns exist much further back; the source that is free to redistribute starts in 1976. Rather than hide the seam, every pre-1976 row says _which kind_ of null it carries — a state that held no popular vote is a different fact from a year this surface cannot reach.

<div class="mt-5"></div>

## What Sets It Apart

- **The dataset is the deliverable.** A cleanly joined electoral-and-popular-vote record on one shared model, running back to 1824, doesn't appear to exist publicly for free. It is a resource on its own terms, not just an input to somebody's argument.
- **Distinctions the sources kept, kept.** Cast vs. counted vs. appointed; no-popular-vote vs. zero-votes vs. took-no-part; disputed vs. resolved. A tidy summary would assume each of these away, silently, and the resulting numbers would still balance.
- **Public without being partisan.** The record states what happened and stops there. Whoever wants to argue for the Electoral College, the popular vote, or something between now has the same numbers to argue from.
- **Cheap enough to leave running.** Scale-to-zero, a single capped instance, edge caching, and a budget kill-switch put a public API for two centuries of election data inside the free tier.

<div class="mt-5"></div>

## Technology Stack

- **Language:** Python 3.11+ (developed on 3.14), managed with [uv](https://docs.astral.sh/uv/)
- **Warehouse:** PostgreSQL star schema, psycopg2, [pandas](https://pandas.pydata.org), [GeoPandas](https://geopandas.org) for state geography
- **Scraping:** [BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/) + requests, with a politeness-honoring local corpus
- **API:** [FastAPI](https://fastapi.tiangolo.com) + [Pydantic](https://docs.pydantic.dev) over a read-only SQLite snapshot
- **Testing:** [pytest](https://pytest.org) (1,099 tests), [mypy](https://mypy.readthedocs.io), [ruff](https://docs.astral.sh/ruff/)
- **Deployment:** Docker, Google Cloud Run, Cloudflare Workers, GitHub Actions with Workload Identity Federation

<div class="mt-5"></div>

## The Blog Series — _Counted, Not Assumed_

An accompanying series reads two centuries of presidential elections from what the record actually says instead of the shorthand everyone repeats — legislature-chosen states, cast-versus-appointed electors, a number frozen by policy choice, a name with three correct spellings. Ten posts are planned; the series states what the record shows and leaves the conclusions to the reader.

<a href="{{ '/blog/2026/222-votes-away/' | relative_url }}" class="btn btn-outline-primary">
  Post 1 — 222 Votes Away, and a Record Few Can Get End to End
</a>

<div class="mt-5"></div>

## Links

<a href="https://github.com/frederick-douglas-pearce/us-presidential-vote-analysis" class="btn btn-outline-primary me-2">
  <i class="fab fa-github"></i> View on GitHub
</a>
<a href="https://api.us-presidential-election-center.org/docs" class="btn btn-outline-primary">
  <i class="fas fa-code"></i> Public API Docs
</a>
