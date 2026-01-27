---
layout: page
title: ESG News Feed
permalink: /esg-news/
description: Real-time ESG news for sportswear brands with filtering by brand and category
nav: false
enable_math: false
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

{% if site.data.esg_news.scorecard %}

  <!-- Sportswear Sustainability Scorecard -->
  <div id="scorecard-section" class="mb-4">
    <h3 class="scorecard-title text-center">Sportswear Sustainability Scorecard</h3>
    <p class="text-muted small text-center">
      Based on {{ site.data.esg_news.scorecard.articles_after_dedup }} unique articles from {{ site.data.esg_news.scorecard.period_start }} to {{ site.data.esg_news.scorecard.period_end }}
      {% if site.data.esg_news.scorecard.duplicates_removed > 0 %}
      ({{ site.data.esg_news.scorecard.duplicates_removed }} duplicates removed)
      {% endif %}
    </p>

    <div class="row">
      <!-- Top Performers -->
      <div class="col-md-6 mb-3">
        <h5 class="scorecard-section-title text-center">Top Performers</h5>
        <div id="top-brands">
          {% if site.data.esg_news.scorecard.top_brands.size > 0 %}
            {% for brand in site.data.esg_news.scorecard.top_brands %}
            <div class="scorecard-card top-performer">
              <span class="medal">
                {% if brand.medal == "gold" %}🥇{% elsif brand.medal == "silver" %}🥈{% elsif brand.medal == "bronze" %}🥉{% endif %}
              </span>
              <span class="brand-name">{{ brand.brand }}</span>
              <span class="total-score badge bg-success">+{{ brand.total }}</span>
              <div class="category-breakdown">
                {% assign env = brand.environmental | plus: 0 %}
                {% assign soc = brand.social | plus: 0 %}
                {% assign gov = brand.governance | plus: 0 %}
                {% assign dig = brand.digital_transformation | plus: 0 %}
                {% if env != 0 %}
                  <span class="badge cat-badge cat-env">E:{% if env > 0 %}+{% endif %}{{ env }}</span>
                {% endif %}
                {% if soc != 0 %}
                  <span class="badge cat-badge cat-soc">S:{% if soc > 0 %}+{% endif %}{{ soc }}</span>
                {% endif %}
                {% if gov != 0 %}
                  <span class="badge cat-badge cat-gov">G:{% if gov > 0 %}+{% endif %}{{ gov }}</span>
                {% endif %}
                {% if dig != 0 %}
                  <span class="badge cat-badge cat-dig">D:{% if dig > 0 %}+{% endif %}{{ dig }}</span>
                {% endif %}
              </div>
            </div>
            {% endfor %}
          {% else %}
            <p class="text-muted">No brands with positive scores in this period</p>
          {% endif %}
        </div>
      </div>

      <!-- Last Performers -->
      <div class="col-md-6 mb-3">
        <h5 class="scorecard-section-title text-center">Last Performers</h5>
        <div id="bottom-brands">
          {% if site.data.esg_news.scorecard.bottom_brands.size > 0 %}
            {% for brand in site.data.esg_news.scorecard.bottom_brands %}
            <div class="scorecard-card last-performer">
              <span class="brand-name">{{ brand.brand }}</span>
              <span class="total-score badge bg-danger">{{ brand.total }}</span>
              <div class="category-breakdown">
                {% assign env = brand.environmental | plus: 0 %}
                {% assign soc = brand.social | plus: 0 %}
                {% assign gov = brand.governance | plus: 0 %}
                {% assign dig = brand.digital_transformation | plus: 0 %}
                {% if env != 0 %}
                  <span class="badge cat-badge cat-env">E:{% if env > 0 %}+{% endif %}{{ env }}</span>
                {% endif %}
                {% if soc != 0 %}
                  <span class="badge cat-badge cat-soc">S:{% if soc > 0 %}+{% endif %}{{ soc }}</span>
                {% endif %}
                {% if gov != 0 %}
                  <span class="badge cat-badge cat-gov">G:{% if gov > 0 %}+{% endif %}{{ gov }}</span>
                {% endif %}
                {% if dig != 0 %}
                  <span class="badge cat-badge cat-dig">D:{% if dig > 0 %}+{% endif %}{{ dig }}</span>
                {% endif %}
              </div>
            </div>
            {% endfor %}
          {% else %}
            <p class="text-muted">No brands with negative scores in this period</p>
          {% endif %}
        </div>
      </div>
    </div>

    <!-- Scoring Legend -->
    <div class="scorecard-legend mt-2 text-center">
      <small class="text-muted">
        <strong>Scoring:</strong> Positive coverage = +2 pts, Neutral = +1 pt, Negative = -1 pt<br>
        <strong>Categories:</strong> E = Environmental, S = Social, G = Governance, D = Digital Transformation<br>
        <em>Note: Top performers must have positive scores; last performers must have negative scores. Fewer than 3 brands may be shown.</em>
      </small>
    </div>

  </div>
  {% endif %}

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

        <div class="filter-group mb-3">
          <label class="form-label"><strong>Date Range</strong></label>
          <div class="date-presets mb-2">
            <button type="button" class="btn btn-outline-primary btn-sm date-preset" data-days="7">7 days</button>
            <button type="button" class="btn btn-outline-primary btn-sm date-preset" data-days="14">14 days</button>
            <button type="button" class="btn btn-outline-primary btn-sm date-preset" data-days="30">30 days</button>
            <button type="button" class="btn btn-outline-primary btn-sm date-preset active" data-days="all">All</button>
          </div>
          <div class="date-inputs">
            <div class="row g-2">
              <div class="col-6">
                <label for="startDate" class="form-label small text-muted">From</label>
                <input type="date" id="startDate" class="form-control form-control-sm">
              </div>
              <div class="col-6">
                <label for="endDate" class="form-label small text-muted">To</label>
                <input type="date" id="endDate" class="form-control form-control-sm">
              </div>
            </div>
          </div>
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
             data-date="{{ article.published_date }}"
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
                      {% if ev.context_snippet %}
                      <div class="evidence-chunk small mt-1">
                        <div class="chunk-text">{{ ev.context_snippet }}</div>
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

      <!-- Pagination -->
      <div id="pagination" class="mt-4"></div>

      <!-- No results message -->
      <div id="noResults" class="alert alert-info" style="display: none;">
        No articles match your filter criteria. Try adjusting your filters.
      </div>
    </div>

  </div>
</div>

<script src="{{ '/assets/js/esg_news_filter.js' | relative_url }}"></script>
