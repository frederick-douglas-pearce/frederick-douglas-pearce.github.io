---
layout: page
title: CodeFluent
description: Personal AI fluency analytics for Claude Code users
img: assets/img/codefluent_fluency.png
importance: 1
category: work
---

## Overview

CodeFluent is an open-source tool that helps developers measure and improve how effectively they collaborate with AI coding assistants. While millions of developers use AI assistants daily, Anthropic's research shows most users exhibit only 3 of 11 key fluency behaviors — and that interaction patterns directly predict whether developers build skills or lose them.

CodeFluent reads your local Claude Code session data, scores your prompting behaviors against [Anthropic's AI Fluency Research](https://www.anthropic.com/research/AI-fluency-index), and provides actionable recommendations to become a more effective AI collaborator. Available as an open-source **[VS Code extension](https://marketplace.visualstudio.com/items?itemName=frederick-douglas-pearce.codefluent)** published on the Visual Studio Marketplace and a **standalone web app**.

<div class="mt-5"></div>

## Key Features

| Feature                      | Description                                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fluency Score**            | Scores sessions against 11 fluency behaviors and 6 coding interaction patterns, with color-coded benchmark comparisons                                                                                                                        |
| **Prompt Optimizer**         | Paste any prompt and get an optimized version that incorporates missing fluency behaviors, factoring in your CLAUDE.md config so it won't duplicate covered behaviors. Shows before/after scores and lets you copy or run the result directly |
| **Quick Wins**               | Scans your GitHub repos and generates copy-paste-ready Claude Code prompts for high-value tasks, scoped to the selected project and launchable directly from VS Code                                                                          |
| **Recommendations**          | Personalized, research-backed coaching prioritized by impact, with links to the underlying Anthropic research papers                                                                                                                          |
| **CLAUDE.md Config Scoring** | Analyzes your project's CLAUDE.md against the same fluency framework — behaviors defined as conventions boost your effective score                                                                                                            |
| **Usage Dashboard**          | Token consumption, cost tracking, and model breakdown from your Claude Code history via stacked area charts                                                                                                                                   |

<div class="mt-5"></div>

## How It Works

<div class="row mt-4">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Session Parsing</h5>
                <p class="card-text mb-0">Parses JSONL session files from <code>~/.claude/projects/</code> to extract user prompts and metadata including plan mode usage, tool diversity, and thinking count.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Fluency Scoring</h5>
                <p class="card-text mb-0">Sends prompts to Claude Sonnet for behavioral scoring against Anthropic's 4D AI Fluency Framework, with results cached locally to avoid re-scoring.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Config Analysis</h5>
                <p class="card-text mb-0">Scores CLAUDE.md project configuration separately, merging with session scores via <code>session OR config</code> logic for effective behavior calculation.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Usage Tracking</h5>
                <p class="card-text mb-0">Integrates <a href="https://github.com/ryoppippi/ccusage">ccusage</a> to read Claude Code session history and export token/cost data with cache read/creation/input/output breakdown.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">GitHub Integration</h5>
                <p class="card-text mb-0">Uses the <code>gh</code> CLI to pull repo context and open issues, generating targeted Claude Code prompts scoped to your current workspace.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Prompt Optimization</h5>
                <p class="card-text mb-0">Analyzes any prompt against the 11 fluency behaviors, factors in your CLAUDE.md config (scoring on demand if not cached), then generates an optimized version that incorporates only the missing behaviors not already covered by project conventions.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## What Sets It Apart

Existing Claude Code monitoring tools measure _what happened_ — token counts, costs, error rates. CodeFluent is the first tool to analyze _how_ you interact with AI and whether your patterns build or erode skills. Every score maps to published population benchmarks from Anthropic's research, not subjective heuristics.

All data stays on your machine. The only external calls are to the Anthropic API for scoring.

<div class="mt-5"></div>

## Technology Stack

- **VS Code Extension:** TypeScript, VS Code WebviewViewProvider
- **Web App:** Python, FastAPI, uv
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js
- **Scoring:** Anthropic API (Claude Sonnet)
- **Usage Data:** [ccusage](https://github.com/ryoppippi/ccusage)
- **GitHub Integration:** `gh` CLI
- **Testing:** Jest + ts-jest, pytest (662 tests including security-focused suites)
- **CI/CD:** GitHub Actions with automated testing, security audit (`pip-audit`), and marketplace publishing

<div class="mt-5"></div>

## Supported Platforms

| Platform | VS Code Extension | Web App |
| -------- | :---------------: | :-----: |
| Linux    |        Yes        |   Yes   |
| macOS    |        Yes        |   Yes   |
| Windows  |        Yes        |   Yes   |

<div class="mt-5"></div>

## Research Foundations

- [Anthropic AI Fluency Index](https://www.anthropic.com/research/AI-fluency-index) (Feb 2026) — 11 behavioral indicators and population benchmarks
- [Coding Skills Formation with AI](https://www.anthropic.com/research/coding-skill-formation) (Jan 2026) — 6 coding interaction patterns and quality analysis
- [Claude Code Best Practices](https://www.anthropic.com/research/claude-code-best-practices) — Practical guidelines for effective AI collaboration

<div class="mt-5"></div>

## Links

<a href="https://github.com/frederick-douglas-pearce/codefluent" class="btn btn-outline-primary me-2">
  <i class="fab fa-github"></i> View on GitHub
</a>
<a href="https://marketplace.visualstudio.com/items?itemName=frederick-douglas-pearce.codefluent" class="btn btn-outline-primary">
  <i class="fas fa-puzzle-piece"></i> VS Code Extension
</a>
