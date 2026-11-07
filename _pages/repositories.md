---
layout: page
permalink: /repositories/
title: repositories
description: A selection of my open-source projects and data science work on GitHub.
---

{% comment %}
The profile summary and repo cards are native HTML rendered from
_data/repository_stats.json (epic #54), not images from github-readme-stats,
whose public instance went down on 17 Aug 2026. The summary (#58) replaces that
service's aggregate "GitHub users" card and carries the profile link. Each sits
inside a block element so kramdown passes the include's HTML through as is.

Upstream al-folio also renders a "trophies" block here from
github-profile-trophy.vercel.app. #60 removed it, with its include and
_config.yml keys, because that service returns 402: switched on, it would bring
back the broken images #54 replaced. Don't restore it from upstream.
{% endcomment %}

<div class="repo-profiles">
  {% for user in site.data.repositories.github_users %}
    {% include repository/repo_user.liquid username=user %}
  {% endfor %}
</div>

{% if site.data.repositories.github_repos %}

## GitHub Repositories

<div class="repo-grid">
  {% for repo in site.data.repositories.github_repos %}
    {% include repository/repo.liquid repository=repo %}
  {% endfor %}
</div>
{% endif %}
