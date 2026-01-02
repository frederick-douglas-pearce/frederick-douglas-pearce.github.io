---
layout: page
title: ESG News Feed
permalink: /esg-news/
description: Real-time ESG news for sportswear brands with filtering by brand and category
nav: false
---

<div class="esg-news-container">
  <!-- Header with stats -->
  <div class="esg-news-header mb-4">
    <p class="lead">
      Monitoring <strong>{{ site.data.esg_news.total_articles }}</strong> ESG news articles
      across <strong>{{ site.data.esg_news.brands | size }}</strong> sportswear brands.
    </p>
    <p class="text-muted">
      <small>Last updated: {{ site.data.esg_news.generated_at | date: "%B %d, %Y at %H:%M UTC" }}</small>
      <a href="{{ '/assets/feeds/esg_news.atom' | relative_url }}" class="ms-2" title="Subscribe to RSS feed">
        <i class="fas fa-rss"></i> RSS Feed
      </a>
    </p>
  </div>

  <!-- Filters -->
  <div class="esg-news-filters card mb-4">
    <div class="card-body">
      <div class="row g-3">
        <div class="col-md-4">
          <label for="brandFilter" class="form-label"><strong>Brand</strong></label>
          <select id="brandFilter" class="form-select" multiple>
            {% for brand in site.data.esg_news.brands %}
            <option value="{{ brand }}">{{ brand }}</option>
            {% endfor %}
          </select>
        </div>
        <div class="col-md-4">
          <label for="categoryFilter" class="form-label"><strong>Category</strong></label>
          <select id="categoryFilter" class="form-select" multiple>
            <option value="environmental">Environmental</option>
            <option value="social">Social</option>
            <option value="governance">Governance</option>
            <option value="digital_transformation">Digital Transformation</option>
          </select>
        </div>
        <div class="col-md-4">
          <label for="sentimentFilter" class="form-label"><strong>Sentiment</strong></label>
          <select id="sentimentFilter" class="form-select">
            <option value="">All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-12">
          <button id="clearFilters" class="btn btn-outline-secondary btn-sm">Clear Filters</button>
          <span id="resultsCount" class="ms-3 text-muted"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Articles container -->
  <div id="articlesContainer" class="esg-news-articles">
    {% for article in site.data.esg_news.articles %}
    <div class="esg-news-card card mb-3"
         data-brands="{{ article.brands | join: ',' }}"
         data-categories="{{ article.categories | join: ',' }}"
         data-sentiments="{% for bd in article.brand_details %}{% for cat in bd.categories %}{% if cat[1].applies and cat[1].sentiment_label %}{{ cat[1].sentiment_label }},{% endif %}{% endfor %}{% endfor %}">

      <div class="card-header d-flex justify-content-between align-items-center">
        <span class="text-muted">
          <small>{{ article.source_name }} &bull; {{ article.published_date }}</small>
        </span>
        <div class="esg-badges">
          {% for brand in article.brands %}
          <span class="badge bg-primary">{{ brand }}</span>
          {% endfor %}
        </div>
      </div>

      <div class="card-body">
        <h5 class="card-title">
          <a href="{{ article.url }}" target="_blank" rel="noopener">{{ article.title }}</a>
        </h5>

        <div class="esg-category-badges mb-2">
          {% for bd in article.brand_details %}
            {% for cat in bd.categories %}
              {% if cat[1].applies %}
                {% assign sentiment_class = "secondary" %}
                {% if cat[1].sentiment_label == "positive" %}
                  {% assign sentiment_class = "success" %}
                {% elsif cat[1].sentiment_label == "negative" %}
                  {% assign sentiment_class = "danger" %}
                {% endif %}
                <span class="badge bg-{{ sentiment_class }}" title="{{ cat[1].sentiment_label | default: 'neutral' }}">
                  {% case cat[0] %}
                    {% when 'environmental' %}Environmental
                    {% when 'social' %}Social
                    {% when 'governance' %}Governance
                    {% when 'digital_transformation' %}Digital
                  {% endcase %}
                </span>
              {% endif %}
            {% endfor %}
          {% endfor %}
        </div>

        <!-- Evidence section (collapsible) -->
        {% assign has_evidence = false %}
        {% for bd in article.brand_details %}
          {% if bd.evidence.size > 0 %}
            {% assign has_evidence = true %}
          {% endif %}
        {% endfor %}

        {% if has_evidence %}
        <div class="esg-evidence mt-3">
          <button class="btn btn-sm btn-outline-secondary evidence-toggle" type="button"
                  data-bs-toggle="collapse" data-bs-target="#evidence-{{ article.id | replace: '-', '' }}"
                  aria-expanded="false">
            Show Evidence
          </button>
          <div class="collapse mt-2" id="evidence-{{ article.id | replace: '-', '' }}">
            {% for bd in article.brand_details %}
              {% if bd.evidence.size > 0 %}
              <div class="evidence-brand mb-2">
                <strong>{{ bd.brand }}</strong>
                <ul class="evidence-list mb-0">
                  {% for ev in bd.evidence limit:3 %}
                  <li class="small">
                    <span class="badge bg-light text-dark">{{ ev.category | replace: '_', ' ' | capitalize }}</span>
                    "{{ ev.excerpt }}"
                  </li>
                  {% endfor %}
                </ul>
              </div>
              {% endif %}
            {% endfor %}
          </div>
        </div>
        {% endif %}
      </div>
    </div>
    {% endfor %}
  </div>

  <!-- No results message -->
  <div id="noResults" class="alert alert-info" style="display: none;">
    No articles match your filter criteria. Try adjusting your filters.
  </div>
</div>

<script src="{{ '/assets/js/esg_news_filter.js' | relative_url }}"></script>
