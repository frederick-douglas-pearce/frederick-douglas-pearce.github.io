---
layout: page
permalink: /repositories/
title: repositories
description: A selection of my open-source projects and data science work on GitHub.
---

{% comment %}
The repo cards are native HTML rendered from _data/repository_stats.json
(epic #54), not images from github-readme-stats, whose public instance went
down on 17 Aug 2026. The aggregate "GitHub users" card that used to sit above
the grid is left out until #58 replaces it natively; the profile link below
stands in for it.
{% endcomment %}

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

{% if site.data.repositories.github_repos %}

## GitHub Repositories

<div class="repo-grid">
  {% for repo in site.data.repositories.github_repos %}
    {% include repository/repo.liquid repository=repo %}
  {% endfor %}
</div>
{% endif %}

{% for user in site.data.repositories.github_users %}

<p>
  Full profile:
  <a href="https://github.com/{{ user }}">github.com/{{ user }}</a>
</p>
{% endfor %}
