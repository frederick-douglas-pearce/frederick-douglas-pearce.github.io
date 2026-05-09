---
layout: post
title: "Pointing AgentFluent at My Own Sessions: The Baseline"
date: 2026-05-09 12:00:00-0800
description: "Baseline diagnostics from running AgentFluent against my ESG news classifier sessions: what it saw, what it flagged, and what comes next."
tags: ["agentfluent", "claude-code", "agent-quality"]
categories: ["external-services"]
featured: false
---

I have been building an ESG news classifier with Claude Code. Here is what
happened when I pointed AgentFluent at my own sessions.

## The project

The classifier ingests news articles about 50 sportswear and outdoor brands
and labels them across four ESG-adjacent categories: Environmental, Social,
Governance, and Digital Transformation. Collection runs against NewsData.io
and GDELT. Articles are scraped, chunked, embedded, and routed through a
pre-filter classifier before Claude Sonnet does the multi-label
classification with evidence excerpts. Two upstream classifiers are already
in production: a false positive filter (Test F2 = 0.987) and an ESG
pre-filter (Test F2 = 0.931). The labeled output drives a public
sustainability scorecard on my personal site.

It is a real system with real engineering work ahead -- evaluation, ESG
multi-label modeling, MLOps. Every Claude Code session on it produces a
JSONL transcript. Those transcripts are also the input AgentFluent reads.

## What AgentFluent does

AgentFluent (v0.6.0 here) ingests Claude Code session JSONL and emits
diagnostics: token and cost accounting, tool-use distributions, subagent
behavior, and pattern signals like retry loops, consecutive tool errors, and
configured-but-unused MCP servers. The output is meant to be actionable --
each warning points at a prompt, a subagent definition, or a config file
with a specific change to consider.

The premise of this experiment is simple: use the tool on the project,
follow the recommendations, and measure the deltas. The project benefits
from the workflow improvements; the workflow improvements generate
before/after data; the data becomes the story.

## What the baseline showed

I ran `agentfluent analyze --project classifier --diagnostics` in
full-history mode on 2026-05-09. Two sessions, captured.

**Cost and tokens.** 22.4M total tokens across 174 API calls, costing $22.76
at the API pay-per-token rate. (I am on a subscription plan, so the actual
monthly spend is fixed and independent of usage -- I cite the API rate
because it is the metric AgentFluent surfaces and the one that lets me
compare workloads apples-to-apples.) Cache efficiency was 94.9%, which is
healthy: the cache is doing most of the work.

**Tool concentration.** Bash dominated at 61.8% of all tool calls (115 of
186), followed by Read at 13.4% and Edit at 4.8%. Heavy Bash use is not
inherently bad, but it correlates with manual orchestration that more
specialized tools or skills could often handle more directly.

**Subagent usage.** 8 agent invocations, evenly split between `architect`
(4) and `pm` (4). Together they consumed 1.7% of total tokens. So the
subagents exist and are being used -- the question is whether they are
being used well.

**Diagnostic signals.** This is where AgentFluent earns its keep:

- `pm` retried `Grep` 3 times in one sequence, and `Read` 3 times in another
- `architect` retried `Glob` 4 times
- `pm` had 2 consecutive tool errors without recovery
- The `playwright` MCP server is configured globally but logged zero tool
  calls across all 8 sessions analyzed
- `architect` review comments surfaced finding-keywords on four occasions,
  raising a quality question: are those findings actionable, or is the
  parent workflow ignoring them?

The retry-loop signals are the most concrete. They point at specific prompt
files (`~/.claude/agents/pm.md`, `~/.claude/agents/architect.md`) and a
specific shape of fix: better stop conditions and alternative-tool fallbacks
for when a search or glob comes back empty.

## Honest caveats

Two sessions is a small sample. AgentFluent's pattern signals get more
reliable as session count grows; at n=2 these are directional indicators,
not statistical findings. The retry loops happened -- those are real events
in the JSONL -- but whether they represent a systemic prompt issue or two
unlucky sessions is something only more data will tell. The same applies to
the `architect` reviewer signal.

The baseline is a cold start. I am treating it as such.

## What is next

Phase 1 is one measured experiment. I will pick the highest-confidence
recommendation from the baseline, implement the change on a feature branch
with the standard project workflow, and rerun `agentfluent analyze` plus
`agentfluent diff` afterward to capture the before/after delta. I am not
going to telegraph which target I am choosing here -- the selection
rationale belongs in its own write-up, alongside the result.

If the experiment moves the needle, I will say so with numbers. If it does
not, I will say that too, with numbers. A null result that is honestly
reported is still a data point. The point of the exercise is not to make
AgentFluent look good; it is to find out what changes when you actually act
on what it tells you.

More to come once Phase 1 sessions are in.
