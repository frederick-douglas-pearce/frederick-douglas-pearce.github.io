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

  <!-- Two-column layout: Sidebar + Articles -->
  <div class="row">
    <!-- Left Sidebar - Filters -->
    <div class="col-lg-3 col-md-4">
      <div class="esg-news-sidebar">
        <h5 class="sidebar-title">Filters</h5>

        <div class="filter-group mb-3">
          <label for="brandFilter" class="form-label"><strong>Brand</strong></label>
          <select id="brandFilter" class="form-select" multiple>
            {% for brand in site.data.esg_news.brands %}
            <option value="{{ brand }}">{{ brand }}</option>
            {% endfor %}
          </select>
        </div>

        <div class="filter-group mb-3">
          <label for="categoryFilter" class="form-label"><strong>Category</strong></label>
          <select id="categoryFilter" class="form-select" multiple>
            <option value="environmental">Environmental</option>
            <option value="social">Social</option>
            <option value="governance">Governance</option>
            <option value="digital_transformation">Digital Transformation</option>
          </select>
        </div>

        <div class="filter-group mb-3">
          <label for="sentimentFilter" class="form-label"><strong>Sentiment</strong></label>
          <select id="sentimentFilter" class="form-select">
            <option value="">All</option>
            <option value="positive">Positive (+)</option>
            <option value="neutral">Neutral (0)</option>
            <option value="negative">Negative (−)</option>
          </select>
        </div>

        <button id="clearFilters" class="btn btn-outline-secondary btn-sm w-100 mb-3">Clear Filters</button>
        <span id="resultsCount" class="text-muted small d-block"></span>

        <!-- Sentiment Legend -->
        <div class="sentiment-legend mt-4">
          <h6>Sentiment Key</h6>
          <div class="legend-item">
            <span class="badge bg-success">Category +</span>
            <span class="legend-label">Positive</span>
          </div>
          <div class="legend-item">
            <span class="badge bg-secondary">Category</span>
            <span class="legend-label">Neutral</span>
          </div>
          <div class="legend-item">
            <span class="badge bg-danger">Category −</span>
            <span class="legend-label">Negative</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content - Articles -->
    <div class="col-lg-9 col-md-8">
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
                    {% assign sentiment_symbol = "" %}
                    {% if cat[1].sentiment_label == "positive" %}
                      {% assign sentiment_class = "success" %}
                      {% assign sentiment_symbol = " +" %}
                    {% elsif cat[1].sentiment_label == "negative" %}
                      {% assign sentiment_class = "danger" %}
                      {% assign sentiment_symbol = " −" %}
                    {% endif %}
                    <span class="badge bg-{{ sentiment_class }}">
                      {% case cat[0] %}
                        {% when 'environmental' %}Environmental{{ sentiment_symbol }}
                        {% when 'social' %}Social{{ sentiment_symbol }}
                        {% when 'governance' %}Governance{{ sentiment_symbol }}
                        {% when 'digital_transformation' %}Digital{{ sentiment_symbol }}
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
                  <div class="evidence-brand mb-3">
                    <strong>{{ bd.brand }}</strong>
                    {% for ev in bd.evidence limit:3 %}
                    <div class="evidence-item mt-2">
                      <div class="evidence-category">
                        <span class="badge bg-light text-dark">{{ ev.category | replace: '_', ' ' | capitalize }}</span>
                      </div>
                      {% if ev.chunk_text %}
                      <div class="evidence-chunk small mt-1">
                        <div class="chunk-text">{{ ev.chunk_text }}</div>
                        <div class="excerpt-highlight mt-1">
                          <strong>Key excerpt:</strong> "{{ ev.excerpt }}"
                        </div>
                      </div>
                      {% else %}
                      <div class="evidence-excerpt small mt-1">
                        "{{ ev.excerpt }}"
                      </div>
                      {% endif %}
                    </div>
                    {% endfor %}
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
  </div>
</div>

<script src="{{ '/assets/js/esg_news_filter.js' | relative_url }}"></script>
