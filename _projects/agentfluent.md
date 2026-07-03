---
layout: page
title: AgentFluent
description: Local-first agent analytics with behavior-to-improvement diagnostics for Claude Code and the Agent SDK
img: assets/img/agentfluent_config_check.svg
importance: 1
category: work
---

## Overview

AgentFluent is an open-source, local-first analytics tool for AI agents built on [Claude Code](https://code.claude.com) and the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview). AI agents are in production at 57% of organizations, and quality is the single top barrier to deployment. When an agent misbehaves — wrong tool choice, retry loops, hallucinated outputs — developers iterate on prompts, tool definitions, etc, but it can be difficult to identify what needs improvement.

Existing observability platforms show _what_ happened: traces, latency, token counts. AgentFluent tells you _why_ the agent misbehaved and _what in its configuration to change_. It reads your local session JSONL, extracts agent invocations and tool patterns, scores each agent's configuration against a best-practice rubric, and correlates observed behavior back to a specific fix — a prompt gap, a missing tool constraint, or a stale model selection. No cloud services, no API keys, no data leaves your machine.

Born from **[CodeFluent](/projects/codefluent/)** research that identified the agent-quality gap. Where CodeFluent coaches the human to interact with Claude Code better, AgentFluent scores the agent's own config — because in programmatic agents, the prompt and tool setup _are_ the agent.

<div class="mt-5"></div>

## The Three Axes

Every recommendation lands on one of three axes, so you can prioritize by what matters right now. The three often trade off — saving cost can hurt quality, chasing speed can hurt cost — and AgentFluent surfaces the trade-off rather than collapsing it to a single score.

| Axis            | What it tracks                                                 | Example finding                                       |
| --------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| **`[cost]`**    | tokens, cache efficiency, model fit, offload candidates        | This agent uses Opus where Sonnet would do            |
| **`[speed]`**   | duration, retry density, tool-call churn, stuck patterns       | This agent retries Bash 5× before giving up           |
| **`[quality]`** | user mid-flight corrections, file rework, reviewer-caught rate | This agent ships work that gets immediately rewritten |

<div class="mt-5"></div>

## Commands

<div class="row mt-4">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title"><code>analyze</code></h5>
                <p class="card-text mb-0">Produces token, cost, and behavior metrics for a project — a per-model cost breakdown, an Agent Invocations table, and behavior diagnostics across metadata, trace, and aggregate layers. A Top-N priority-fixes summary ranks findings by a composite <code>priority_score</code>, and an Offload Candidates section proposes moving repeating tool-use clusters onto cheaper-tier models.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><code>config-check</code></h5>
                <p class="card-text mb-0">Walks <code>~/.claude/agents/*.md</code> and <code>./.claude/agents/*.md</code>, parses each agent's frontmatter and body, and scores against a 4-dimension rubric — description trigger quality, tool access, model selection, and prompt completeness — with ranked recommendations per agent.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><code>diff</code></h5>
                <p class="card-text mb-0">Compares two <code>analyze --json</code> snapshots and surfaces new, resolved, and persisting recommendations plus token / cost / invocation deltas. <code>--fail-on</code> gates exit code 3 on new findings, so <code>diff</code> slots into a PR check the same way a test runner does.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><code>report</code></h5>
                <p class="card-text mb-0">Renders an <code>analyze --json</code> snapshot as a Markdown document — the same Summary / Token / Diagnostics / Offload sections — in a form you can paste into a PR comment, attach as a CI artifact, or commit alongside a prompt change as a review trail.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title"><code>list</code></h5>
                <p class="card-text mb-0">Discovers every Claude Code / Agent SDK project under <code>~/.claude/projects/</code>, with session counts, total size, and last-modified timestamps. Pass <code>--project</code> to drill into one project's individual session files.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## What Sets It Apart

The agent observability space is crowded — several tools capture _what_ agents do. None diagnose _why_ they misbehave or _what to change_ from locally-persisted session data.

- **The config is the agent.** In interactive sessions the human course-corrects mid-flight; in programmatic agents the prompt and tool setup _are_ the agent, and a flaw compounds at scale. AgentFluent scores description, `allowed_tools` / `disallowedTools`, model, and prompt on every agent definition, and audits MCP server configuration (configured-but-unused, observed-but-missing) against real tool usage.
- **Behavior-to-improvement, not just traces.** When an agent retries Bash 40% of the time, AgentFluent tells you _which prompt clause is missing_ — not just that the retry happened. Every diagnostic maps to a specific config surface and a pointer to the file to edit.
- **JSON envelope as a contract.** A stable `{version, command, data}` schema lets you build PR gates, trend dashboards, and regression detectors on top without tracking AgentFluent's internal refactors.
- **CLI-native and local by default.** `agentfluent analyze --format json | jq ...` fits terminal, CI/CD, and PR-check workflows. No outbound network calls unless you explicitly opt in via `--git` (local git) or `--github` (GitHub-API quality signals).

<div class="mt-5"></div>

## Technology Stack

- **Language:** Python 3.12+
- **CLI:** [Typer](https://typer.tiangolo.com) + [Rich](https://rich.readthedocs.io) for terminal formatting
- **Data Models:** [Pydantic v2](https://docs.pydantic.dev) across module boundaries
- **Config Parsing:** [PyYAML](https://pyyaml.org) (`safe_load` only) for agent frontmatter
- **Optional:** [scikit-learn](https://scikit-learn.org) for delegation clustering (`agentfluent[clustering]`)
- **Testing:** [pytest](https://pytest.org) + pytest-cov (1600+ tests), [mypy](https://mypy.readthedocs.io) strict mode
- **Tooling:** [ruff](https://docs.astral.sh/ruff/) for linting/formatting, [uv](https://docs.astral.sh/uv/) for packaging
- **CI/CD:** GitHub Actions — automated testing, type checking, and PyPI publishing

<div class="mt-5"></div>

## Supported Platforms

| Platform | CLI |
| -------- | :-: |
| Linux    | Yes |
| macOS    | Yes |
| Windows  | Yes |

Pure-Python package; path handling resolves `~/.claude/` on every platform. Requires **Python 3.12 or newer**.

<div class="mt-5"></div>

## Install

```bash
# Preferred — isolated tool install via uv
uv tool install agentfluent

# Fallback — pip into a venv of your choice
pip install agentfluent

# Zero-install one-shot
uvx agentfluent list
```

<div class="mt-5"></div>

## Links

<a href="https://github.com/frederick-douglas-pearce/agentfluent" class="btn btn-outline-primary me-2">
  <i class="fab fa-github"></i> View on GitHub
</a>
<a href="https://pypi.org/project/agentfluent/" class="btn btn-outline-primary">
  <i class="fab fa-python"></i> PyPI Package
</a>
