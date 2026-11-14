---
layout: page
title: Claude Code Loop
description: An AI dev team that works your backlog with the checks a good human team has, while you keep the decisions
img: assets/img/claude_code_loop_ledger.svg
og_image: https://frederick-douglas-pearce.github.io/assets/img/claude-code-loop-og.png
importance: 1
category: work
# No math on this page, and MathJax's `$` delimiter would typeset the dollar amounts.
enable_math: false
---

## Overview

Claude Code Loop is an AI dev team that works through your backlog with the checks a good human team has, while you keep the decisions. It runs inside [Claude Code](https://code.claude.com) as a plugin. It takes one issue at a time from your GitHub backlog and carries it from scoping to merge. A product manager agent scopes it, an architect agent reviews the design before any code is written, and the main agent builds it. Other agents review the code, and an agent that didn't write it checks the result. By default it stops for your approval on every plan before any code is written and on every merge.

What that gets you:

- **The right thing gets built.** A feature has to name who it's for, and what would show it's the wrong thing to build, before any code exists.
- **Problems surface early.** The design is reviewed before code, and the work is never checked by the agent that did it.
- **Security gets a look.** Built-in security review where the change calls for it, and a short list of rules on what the loop must never do.
- **You stay in charge, with a record.** Two human approvals, and every gate decision added to a running record on disk.
- **Cost is measured, not guessed.** I price every session from Claude Code's own records and use the numbers to decide what to change.

It runs today on seven projects, including its own: the loop works its own backlog. It was built inside my **[AgentFluent](/projects/agentfluent/)** project and then pulled out so any project can use it.

<div class="mt-5"></div>

## A Dev Team, in a Loop

The pipeline is modeled on the roles of a human team. Each project's settings file says which agent fills each role. The plugin doesn't come with agents of its own: you point the product manager and architect roles at agents you already have.

| Team role             | What it does in the loop                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product manager**   | answers scope, priority and requirements questions, and splits an issue too large for one pass                                                                                                  |
| **Architect**         | reviews the design before any code is written: whether it fits the project's conventions and existing code, reuses what's there, and leaves room for the roadmap. It reads but never edits code |
| **Developer**         | the main agent, which also coordinates the others: plans, writes the code, runs your automated checks, opens the pull request                                                                   |
| **Code reviewers**    | several reviewer agents read the change side by side, each given the issue's acceptance criteria (its written definition of done)                                                               |
| **Security reviewer** | runs when the kind of change and the files it touches call for it                                                                                                                               |
| **QA**                | an agent that didn't do the work checks every acceptance criterion, and whether the tests would catch the code breaking later                                                                   |
| **Owner**             | you: approve plans, approve merges, and settle anything the agents disagree on                                                                                                                  |

A business analyst agent, which keeps a glossary so the roles stop talking past each other, isn't built into the plugin yet. Two of my projects add one through their own settings files.

<div class="mt-5"></div>

## What It Gives You

Each step the work must pass before it moves on, whether an agent's review or your approval, is a gate.

<div class="row mt-4">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">It builds the right thing</h3>
                <p class="card-text">Agents have made features easier to build, not easier to choose. Before any code exists, a feature plan has to name who it's for and an observation that would show the feature is the wrong thing to build. An issue too big for one pass goes to the product manager agent for a split. If a plan would deliver less than the issue asks, the cut is recorded on the issue and the removed scope is filed as a new one.</p>
                <p class="card-text mb-0"><strong>Example:</strong> in my election-data project, a proposed cache fix assumed visitors would request the same uncached page at the same moment. The plan checked a month of the dashboard's logs and found no two requests for the same page within 30 seconds. I closed it with no code written.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">It catches problems early and often</h3>
                <p class="card-text">Review is done by agents that didn't write the code, and a fix is never checked by the agent that wrote it. On a code change that alters behavior, the final QA check also breaks the code on purpose, in a throwaway copy, to see whether the tests notice. Code review asks the same question of any new tests.</p>
                <p class="card-text mb-0"><strong>Example:</strong> when a reviewer finds a problem serious enough to hold the merge, and it raises a design question, the loop stops and brings it to you, with the architect's ruling on scope attached. It never dismisses the problem on its own.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">It takes care with security</h3>
                <p class="card-text">There's a built-in security review, run when the kind of change and the files it touches call for it. The loop is instructed never to merge while the automated checks are failing, never to overwrite history on GitHub, to work on one pull request at a time, never to sweep unrelated files into a commit, and never to edit its own settings. Those rules are instructions the agent is told to follow, not a sandbox. What is enforced is narrower: the stops for your approval, and a guard against overwriting the loop's record, within limits the README lists. For a hard boundary, use Claude Code's own permission settings.</p>
                <p class="card-text mb-0"><strong>Example:</strong> auto-merge is off by default, and even when you turn it on it never applies to a feature, a breaking change, or anything touching security-sensitive code.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">You stay in charge, with a record</h3>
                <p class="card-text">You set the two approvals separately: one on the plan, one on the merge. Choosing to review fewer plans never lets more code merge without you. Every gate decision, each agent's review result and each of your approvals, is added to a running record on disk, so the record doesn't depend on the model's memory. The loop picks up where it stopped after the session's working memory is cleared or condensed, or after a crash.</p>
                <p class="card-text mb-0"><strong>Example:</strong> if the architect materially rewrites a plan, the loop stops and shows you what changed before any code is written. No setting turns that stop off.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Code that fits your codebase</h3>
                <p class="card-text">A common complaint about coding agents is that they don't know the codebase they're working in. They ignore the project's conventions, rebuild logic that already exists, and box in the features on the roadmap. The architect is there to catch that before any code is written. In my setup it reads the project's rules, its existing code and its roadmap, then reviews the plan for reuse, one source of truth for each fact, a clear split of responsibilities, and room for what's coming next. It never writes code. It rates each concern as blocking or not, and when a plan is sound it says so. Each project lists the kinds of change that need this review, and the loop also calls it whenever it's unsure.</p>
                <p class="card-text mb-0"><strong>Example:</strong> I asked for an executive brief built on per-PR briefs, with two similar ideas already in the backlog. The architect recommended one combined design instead of three separate ones. It also reversed my plan to commit the briefs to the repo, because "the brief becomes part of the diff it describes." I took both.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Cost is measured, not guessed</h3>
                <p class="card-text">I measure what each session costs from Claude Code's own records, and I've learned that the bill follows how many back-and-forth steps the main agent takes, not how much text it is holding at each step. So the savings come from fewer review rounds, not shorter text. The next lever is a cheaper model for some roles. Early work on it is merged but not released, and today every role uses the main agent's model, so nothing changes yet.</p>
                <p class="card-text mb-0"><strong>Example:</strong> in the October review, on v0.3.1, the median session working one issue cost $17.61 in the loop's own project and $35.61 in the election-data project, including the other agents it called on, which made up about a third of the cost.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Under the Hood

For developers, a condensed version. The [README](https://github.com/frederick-douglas-pearce/claude-code-loop#readme) has the depth.

- **One issue per invocation.** A single supervised orchestrator, not a graph of agents. Re-invoke it for the next issue, or let Claude Code's `/loop` drive it.
- **Routed by risk.** Each issue is routed by its labels and the path rules in your config. A `code` change gets the full pipeline and every gate. `research` gets a lighter plan, `docs` skips the architect and security passes, and `stub-defer` is journaled and left in the backlog.
- **A ledger, not a context window.** Each run keeps a work queue, an append-only journal and a plan per issue under `.claude/loop/`. On resume, the loop checks each unfinished row against live git and PR state before starting anything new.
- **Mutation testing.** On a `code` change that alters behavior, the acceptance gate mutates the guarded code in a throwaway copy of your tree, runs your suite, and reports any test that stayed green.
- **A gate that didn't run never counts as passed.** No verdict means not passed, and a pass covers only the commit it ran on.
- **One engine, one config per project.** Your build commands, branch format, commit convention, merge method and PR template live in one `loop.config.md` that `/init-loop` infers from the repo. The engine is never edited per project.
- **Per-role model tiers.** A `MODEL_TIERS` table in the config binds each role to a tier and an optional effort, for example `mutation: sonnet@medium`. The engine passes only Claude Code's own model aliases, and your environment decides what they resolve to. An entry it can't read falls back to `inherit`. One limit is built in: the implementer is the orchestrating agent itself, so only the session's own model writes the code.
- **Cost research.** The repo keeps a notebook that reads session transcripts and the ledger's per-iteration budget lines and prices them against a shared [cost specification](https://github.com/frederick-douglas-pearce/claude-code-sessions/blob/main/reference/cost-model.md). It's framed as causal inference, since issue difficulty is an unmeasured confounder. Two repos were held back on an older engine as an untreated control until October 31, when I dropped the control because it had too few runs to support the comparison. A paired benchmark replaces it. The [October cost review](https://github.com/frederick-douglas-pearce/claude-code-loop/blob/main/docs/research/cost-review-2026-10-26.md) has the findings.

### Technology Stack

- **Engine:** Markdown instructions that the orchestrating agent executes
- **Platform:** [Claude Code](https://code.claude.com) plugin, installed from its own marketplace
- **Integrations:** git and the [GitHub CLI](https://cli.github.com) (`gh`) for issues, pull requests and CI checks
- **Guard hook and mutation harness:** Python 3.9+, standard library only
- **Testing:** stdlib `unittest`, run on Python 3.9 through 3.13 in CI

<div class="mt-5"></div>

## Status

The plugin is at v0.5.0 and in active use on seven projects, and a 1.0 release is coming soon. At the v0.3.0 release in September, the loop had carried 111 issues to done across the five projects using it then, the last time I took the count. That shows one shared plugin, with its own settings file in each project, holds up under real use. Findings from real runs are collected in [issue #1](https://github.com/frederick-douglas-pearce/claude-code-loop/issues/1), and reports from projects unlike the current seven are welcome.

<div class="mt-5"></div>

## Install

```text
/plugin marketplace add frederick-douglas-pearce/claude-code-loop
/plugin install dev-loop@claude-code-loop
/init-loop
```

Before the first run, read the README's section on what the loop can do to your repo: it creates branches, commits, opens pull requests and merges on your behalf. Then review the generated `.claude/loop.config.md` and ask Claude to "run the dev loop".

<div class="mt-5"></div>

## The Blog Series: _A Cross-Functional Team of One_

_An agent can do every job on a dev team. What it shouldn't do is check its own work._ When the same mind that did the work also checks it, it tends to confirm its own thinking. The series goes gate by gate through how each role in the loop works, the real runs where one nearly let something through, and what changed in the loop afterward. It also covers setting up the loop for your own projects and the cost experiments aimed at making it cheaper without making it weaker.

<a href="{{ '/blog/category/claude-code-loop/' | relative_url }}" class="btn btn-outline-primary">
  Read the series
</a>

<div class="mt-5"></div>

## Interested in Trying It?

I'm helping organizations build more effectively with AI, and this plugin is a big part of how I work. If you'd like to see it on your backlog, or just want to talk through how it would fit your team, the best place to reach me is LinkedIn.

<a href="https://www.linkedin.com/in/frederick-douglas-pearce/" class="btn btn-outline-primary">
  <i class="fab fa-linkedin"></i> Find me on LinkedIn
</a>

<div class="mt-5"></div>

## Links

<a href="https://github.com/frederick-douglas-pearce/claude-code-loop" class="btn btn-outline-primary">
  <i class="fab fa-github"></i> View on GitHub
</a>
