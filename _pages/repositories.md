---
layout: page
permalink: /repositories/
title: repositories
description: A selection of my open-source projects and data science work on GitHub.
---

{% comment %}
The card sections below render remote images from github-readme-stats. The
public instance returns 503 DEPLOYMENT_PAUSED as of 17 Aug 2026 — an
account-level Vercel pause, not rate limiting — so every card renders as a
broken image with only its alt text visible.

They are gated off behind site.repo_stats_cards (false in _config.yml) rather
than deleted, so the diff that restores this page is the one that replaces
them natively. Interim markup below keeps the page useful in the meantime.

Remove the flag, this comment, and the interim block in #56. Epic: #54.
{% endcomment %}

{% if site.repo_stats_cards %}

{% if site.data.repositories.github_users %}

## GitHub users

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
  {% for user in site.data.repositories.github_users %}
    {% include repository/repo_user.liquid username=user %}
  {% endfor %}
</div>

---

{% if site.repo_trophies.enabled %}
{% for user in site.data.repositories.github_users %}
{% if site.data.repositories.github_users.size > 1 %}

  <h4>{{ user }}</h4>
  {% endif %}
  <div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
  {% include repository/repo_trophies.liquid username=user %}
  </div>

---

{% endfor %}
{% endif %}
{% endif %}

{% if site.data.repositories.github_repos %}

## GitHub Repositories

<div class="repositories d-flex flex-wrap flex-md-row flex-column justify-content-between align-items-center">
  {% for repo in site.data.repositories.github_repos %}
    {% include repository/repo.liquid repository=repo %}
  {% endfor %}
</div>
{% endif %}

{% else %}

{% if site.data.repositories.github_repos %}

## GitHub Repositories

<ul>
  {% for repo in site.data.repositories.github_repos %}
    <li>
      <a href="https://github.com/{{ repo }}">{{ repo | split: "/" | last }}</a>
    </li>
  {% endfor %}
</ul>
{% endif %}

{% for user in site.data.repositories.github_users %}

<p>
  Full profile:
  <a href="https://github.com/{{ user }}">github.com/{{ user }}</a>
</p>
{% endfor %}

{% endif %}
