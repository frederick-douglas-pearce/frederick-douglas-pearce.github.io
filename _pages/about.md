---
layout: about
title: about
permalink: /
subtitle: "From Earth Science to AI Engineering — Scientific rigor, production ML, human-centered AI"
# Hand-written for the search result, not shown on the page -- the `about`
# layout renders `subtitle`, never `description`. This feeds only the metadata:
# <meta name="description">, og:/twitter:description, and the WebSite JSON-LD
# (_includes/metadata.liquid). Without it the homepage -- the highest-value page
# for search -- falls back to the generic site-wide `description` in _config.yml.
# Keep it under ~155 characters so Google does not truncate it in the SERP.
description: "ML and AI engineer in Portland, OR with an MIT PhD, building production AI systems that turn hard-to-quantify questions into accountable decisions."

profile:
  align: right
  image: prof_pic.jpg
  image_circular: false # crops the image to make it circular
  more_info: >
    <p>Portland, OR 97212</p>

selected_papers: false # includes a list of papers marked as "selected={true}"
social: true # includes social icons at the bottom of the page

activity:
  enabled: true # includes the merged posts + notes stream below the bio
  limit: 5 # top-N shown here; leave blank to include the full stream (see /activity/)

latest_posts:
  enabled: false
  scrollable: true # adds a vertical scroll bar if there are more than 3 new posts items
  limit: 3 # leave blank to include all the blog posts
---

I'm an ML and AI engineer and data scientist with a PhD from MIT who has been driven to understand how the world works since childhood: drawn to the patterns hiding in data, skilled at building the systems to distill them, and committed to bridging the gap between technical know-how and the people it informs. That drive has led from imaging subducting tectonic plates to understand the forces that shape the Earth and drive damaging earthquakes, through building the data foundation behind the U.S. healthcare system's shift from pay-for-quantity to pay-for-quality, to deploying autonomous AI pipelines that evaluate the sustainability efforts of global sportswear brands. The domain changes, but the approach hasn't: find a hard, ambiguous question, build a system that answers it honestly, and communicate what it means to the people who need to act on it.

The emergence of AI coding tools, and Claude Code in particular, poured fuel on my problem-solving fire. I've been building with it daily since the day it launched, and what started as curiosity about a new tool quickly became something more: a focused effort to understand not just how to use AI effectively, but how to measure whether it is being used well. That question has produced several production systems, and recently led me to complete Anthropic's AI Fluency Framework certification, a formal grounding in the research behind what effective human-AI collaboration actually looks like.

The project at the center of that commitment is the AI Fluency Suite, two complementary open-source tools for evaluating AI effectiveness at both layers of the engagement stack: autonomous agents and the humans collaborating with them. [AgentFluent]({{ '/projects/agentfluent/' | relative_url }}) (PyPI-published, v1.1) works with both Claude Code and the Claude Agent SDK, scoring agent configuration against Anthropic's documented best practices and correlating observed behavior (e.g. retry loops, tool errors, token spend) back to specific gaps with prioritized recommendations. [CodeFluent]({{ '/projects/codefluent/' | relative_url }}) (VS Code extension and web app) evaluates both collaboration quality and project configuration: scoring 11 fluency behaviors and 6 coding interaction patterns against Anthropic's published research, while helping users discover and activate the full range of Claude Code features that make collaboration more effective.

<div class="row mt-4 mb-4">
  <div class="col-12">
    {%
      include figure.liquid
      path="assets/img/agentfluent_config_check.svg"
      class="img-fluid rounded z-depth-1"
      zoomable=true
      alt="Terminal table titled Agent Configuration Scores, listing five agents -- architect, marketer, pm, anthropic-research and candidate-verifier -- each scored from 90 to 100 out of 100, broken out across description, tools, model and prompt columns, with a count of outstanding recommendations for each."
      caption="<code>agentfluent config-check</code> scoring each agent's configuration across description, tools, model, and prompt — and counting what is left to fix."
    %}
  </div>
</div>

The [Sportswear ESG News Classifier]({{ '/projects/esg_classifier/' | relative_url }}) is a fully automated production AI and ML pipeline monitoring ESG news for 50+ global sportswear brands. A hybrid architecture, two ML pre-filter classifiers ahead of Claude-based ESG scoring, cuts inference costs by roughly 10% while preserving recall, and a RAG pipeline with OpenAI embeddings and pgvector retrieves article passages as traceable evidence for every classification. The pipeline runs autonomously at roughly $0.15/day, publishing a live [Sustainability Scorecard]({{ '/esg-news/' | relative_url }}) to this site.

<div class="row mt-4 mb-4">
  <div class="col-12">
    {%
      include figure.liquid
      path="assets/img/sportswear_scorecard_snapshot_081526.png"
      class="img-fluid rounded z-depth-1"
      sizes="(min-width: 930px) 900px, 95vw"
      zoomable=true
      alt="The Sustainability Scorecard, ranking global sportswear brands by an overall ESG score alongside separate environmental, social, governance and digital transformation columns derived from classified news coverage."
      caption="The live Sustainability Scorecard — 50+ global sportswear brands, scored daily from classified news coverage."
    %}
  </div>
</div>

The [US Presidential Voting Data API]({{ '/projects/us_presidential_vote_analysis/' | relative_url }}) takes a different angle: two centuries of Electoral College and popular vote data, reconciled from primary sources into a live public API. Most people have a general sense of how U.S. presidential elections work, but the historical record tells a more nuanced story, including how often the two measures have diverged and what a more balanced approach to determining the winner might look like. The project is as much a data journalism exercise as an engineering one, and exactly the kind of question I have always been drawn to.

Translating my projects into accessible writing is a core part of the mission. The [blog]({{ '/blog/' | relative_url }}) carries two active series: [one documenting the Claude Code session format]({{ '/blog/category/claude-code-sessions/' | relative_url }}) powering the AI Fluency Suite, and ["Counted, Not Assumed,"]({{ '/blog/category/us-presidential-vote/' | relative_url }}) which examines what the presidential election data actually shows when you go back to the primary sources.

My earlier career spans novel algorithm development and quantitative modeling in seismic imaging research at MIT, healthcare data science supporting CMS's Quality Payment Program at Semanticbits, and security anomaly detection at Tripwire. I'm based in Portland, OR and open to remote or hybrid roles at startups and mid-size companies where technical depth and clear thinking about AI's human impact both matter.
