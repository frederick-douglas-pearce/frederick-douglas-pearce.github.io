---
layout: page
title: claude-code-loop
description: A Claude Code plugin that works an issue backlog like a small dev team, one gated issue at a time
img: assets/img/claude_code_loop_ledger.svg
og_image: https://frederick-douglas-pearce.github.io/assets/img/claude-code-loop-og.png
importance: 2
category: work
---

## Overview

claude-code-loop is a [Claude Code](https://code.claude.com) plugin, `dev-loop`, that works through a GitHub issue backlog the way a small, disciplined dev team would. Each invocation takes exactly one issue end to end: scope it, plan it, have the plan design-reviewed, implement it on a branch, open the PR, run code review and (where the change calls for it) security review, have an agent that didn't write the code check it against the acceptance criteria, and merge. By default it stops for your approval on every plan before any code is written and on every merge.

Everything the loop does is written to a ledger on disk rather than kept in the model's context. That's what lets the next invocation pick up where the last one stopped, whether the session ended with a `/clear`, a compaction, or a crash.

The engine was first built and hardened inside **[AgentFluent](/projects/agentfluent/)**, where it ran the v0.10.x and v0.11.0 releases, and was then extracted into its own repo so any project can use it. It now drives six repos, including itself: this repo works its own backlog with the loop it develops.

<div class="mt-5"></div>

## A Dev Team, in a Loop

The pipeline is modeled on the roles of a human team. Each role is a binding in a per-project config file, and the plugin ships no agent definitions of its own: the scope and design roles point at subagents you already have.

| Team role             | What it does in the loop                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Product manager**   | answers scope, priority and requirements questions, and splits an issue too large for one pass      |
| **Architect**         | reviews the plan before any code is written, read-only, when a trigger fires or the loop is unsure  |
| **Developer**         | the orchestrator itself: plans, implements, runs your lint, type and test commands, opens the PR    |
| **Code reviewers**    | parallel read-only reviewers over the diff, each handed the issue's acceptance criteria             |
| **Security reviewer** | runs where the route and the touched files call for it                                              |
| **QA**                | a fresh agent that checks every acceptance criterion and whether the tests would catch a regression |
| **Owner**             | you: approve plans, approve merges, and settle anything the agents disagree on                      |

<div class="mt-5"></div>

## How It Works

<div class="row mt-4">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Routed by risk</h3>
                <p class="card-text mb-0">Each issue is routed by its labels and the path rules in your config. A <code>code</code> change gets the full pipeline and every gate. <code>research</code> gets a lighter plan, <code>docs</code> skips the architect and security passes, and <code>stub-defer</code> is journaled and left in the backlog.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Two human gates</h3>
                <p class="card-text mb-0">The plan gate and the merge gate are set separately, so loosening how much planning you review never loosens what merges without you. Auto-merge exists only for routes you have explicitly graduated, and never for a feature, a breaking change, or anything touching a security surface.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">A ledger, not a context window</h3>
                <p class="card-text mb-0">Each run keeps a work queue, an append-only journal of every gate decision, and a plan per issue under <code>.claude/loop/</code>. On resume, the loop checks each unfinished row against live git and PR state before starting anything new.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Tests that would notice</h3>
                <p class="card-text mb-0">On a change that alters behavior, the acceptance gate breaks the guarded code on purpose in a throwaway copy of your tree, runs your suite, and reports any test that stayed green. A test that can't fail is protection you think you have and don't.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## What Sets It Apart

- **One issue per invocation, end to end.** It's a single supervised orchestrator handling one routed issue at a time, not a graph of agents running in parallel. Re-invoke it for the next issue, or let Claude Code's `/loop` drive it.
- **A gate that didn't run never counts as passed.** No verdict means not passed. A gate's pass covers only the commit it ran on, and expires if the PR changes afterward. A blank binding in the config falls back to a built-in equivalent or stops and asks; it never quietly turns the gate off.
- **A fix is never checked by whoever wrote it.** When the loop fixes a review or acceptance finding, a freshly spawned agent decides whether the fix worked. If that one re-check comes back dirty, the loop stops and asks you instead of iterating on itself.
- **When the architect rewrites the plan, you see the plan.** If design review materially changes the approach, the loop stops and shows you what changed before any code is written. No mode setting reaches that stop.
- **One engine, one config per project.** Your build commands, branch format, commit convention, merge method and PR template live in one `loop.config.md` that `/init-loop` infers from the repo. The engine itself is never edited per project.

<div class="mt-5"></div>

## Measuring What a Run Costs

The repo keeps a research notebook on why an iteration costs what it does and what would make it cheaper without making it worse. It reads Claude Code session transcripts and the ledger's per-iteration budget lines, prices them against a shared [cost specification](https://github.com/frederick-douglas-pearce/claude-code-sessions/blob/main/reference/cost-model.md), and is set up as causal inference rather than trend-reading: issue difficulty is an unmeasured confounder, so config levers are estimated as total effects. Releases reach the consuming repos on different dates, and two repos are deliberately held back on an older engine as an untreated control.

<div class="mt-5"></div>

## Technology Stack

- **Engine:** Markdown instructions that the orchestrating agent executes, split into a core read on every invocation and phase units read when needed
- **Platform:** [Claude Code](https://code.claude.com) plugin, installed from its own marketplace
- **Integrations:** git and the [GitHub CLI](https://cli.github.com) (`gh`) for issues, pull requests and CI checks
- **Guard hook and mutation harness:** Python 3.9+, standard library only
- **Testing:** stdlib `unittest`, run on Python 3.9 through 3.13 in CI, pinning the couplings between files (every parameter the engine reads exists in the onboarding skeleton, the pipeline's step order agrees wherever it's restated)

<div class="mt-5"></div>

## Status

At v0.3.1 the plugin is **not yet stable**. Six repos drive it, and the loop had carried 111 issues to done across five of them by the v0.3.0 release. That's enough to show the plugin and config split holds under real use, but not enough to call it stable. Findings from real runs are collected in [issue #1](https://github.com/frederick-douglas-pearce/claude-code-loop/issues/1), and reports from repos unlike the current six are welcome.

<div class="mt-5"></div>

## Install

```text
/plugin marketplace add frederick-douglas-pearce/claude-code-loop
/plugin install dev-loop@claude-code-loop
/init-loop
```

Before the first run, read the README's section on what the loop can do to your repo: it creates branches, commits, opens pull requests and merges on your behalf. Then review the generated `.claude/loop.config.md` and ask Claude to "run the dev loop".

<div class="mt-5"></div>

## The Blog Series — _A Cross-Functional Team of One_

A coding agent really is cross-functional: it plans, designs, implements and tests. When the same mind that did the work also checks it, it tends to confirm its own thinking. The series goes gate by gate through how each role in the loop works, the real runs where one nearly let something through, and what changed in the loop afterward. It also covers setting up the loop for your own projects and the cost experiments aimed at making it cheaper without making it weaker.

<a href="{{ '/blog/2026/a-loop-to-remember/' | relative_url }}" class="btn btn-outline-primary me-2">
  Post 1 — A Loop to Remember
</a>
<a href="{{ '/blog/category/claude-code-loop/' | relative_url }}" class="btn btn-outline-primary">
  All posts in the series
</a>

<div class="mt-5"></div>

## Links

<a href="https://github.com/frederick-douglas-pearce/claude-code-loop" class="btn btn-outline-primary">
  <i class="fab fa-github"></i> View on GitHub
</a>
