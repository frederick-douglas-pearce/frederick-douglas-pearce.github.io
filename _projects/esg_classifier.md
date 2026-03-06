---
layout: page
title: Sportswear ESG News Classifier
description: Multi-label text classification for sportswear brand ESG news
img: assets/img/esg_news_funnel.png
importance: 2
category: work
---

## Overview

This project implements an end-to-end machine learning pipeline for classifying news articles about sportswear brands into Environmental, Social, Governance (ESG), and Digital Transformation categories. The system monitors 50+ global sportswear brands including Nike, Adidas, Puma, Lululemon, and Patagonia.

<div class="mt-5"></div>

## ESG Categories

The classifier identifies four main categories with ternary sentiment (positive/neutral/negative):

| Category                   | Description                        | Examples                                              |
| -------------------------- | ---------------------------------- | ----------------------------------------------------- |
| **Environmental**          | Climate, emissions, sustainability | Carbon neutrality commitments, recycling programs     |
| **Social**                 | Labor, diversity, community        | Worker rights, DEI initiatives, community programs    |
| **Governance**             | Ethics, transparency, leadership   | Board changes, ethical sourcing, transparency reports |
| **Digital Transformation** | Technology, innovation             | Digital retail, supply chain tech, AI adoption        |

<div class="mt-5"></div>

## Live News Feed

View the classified ESG news articles in real-time:

<a href="{{ '/esg-news/' | relative_url }}" class="btn btn-primary">
  Browse ESG News Feed
</a>

The feed includes {{ site.data.esg_news.total_articles }} articles with interactive filtering by brand and ESG category.

<div class="mt-5"></div>

## Technical Architecture

The pipeline consists of six integrated phases:

<div class="row mt-4">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">Data Collection</h5>
                <p class="card-text mb-0">Automated collection from NewsData.io and GDELT APIs, with intelligent scraping and language detection.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">LLM Labeling</h5>
                <p class="card-text mb-0">Claude Sonnet classifies articles into ESG categories with evidence extraction and sentiment analysis.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">ML Pre-filters</h5>
                <p class="card-text mb-0">Random Forest (FP) and Logistic Regression (EP) classifiers reduce API costs by 40%.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">MLOps</h5>
                <p class="card-text mb-0">MLflow tracking, Evidently drift monitoring, and automated retraining pipeline.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h5 class="card-title">Deployment</h5>
                <p class="card-text mb-0">Docker containers on Google Cloud Run with CI/CD via GitHub Actions.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Technology Stack

- **Data Collection:** Python, PostgreSQL + pgvector, NewsData.io, GDELT
- **ML Pipeline:** scikit-learn, sentence-transformers, spaCy
- **LLM Integration:** Claude Sonnet (Anthropic), OpenAI embeddings
- **MLOps:** MLflow, Evidently AI, Docker, GitHub Actions
- **Deployment:** FastAPI, Google Cloud Run

<div class="mt-5"></div>

## Model Performance

<div class="row mt-4">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-header">False Positive Classifier</div>
            <div class="card-body">
                <p><strong>Model:</strong> Random Forest + Sentence Transformers</p>
                <p><strong>Test F2:</strong> 0.974</p>
                <p><strong>Recall:</strong> 98.8%</p>
                <p class="text-muted mb-0">Filters non-sportswear brand mentions (e.g., "Puma" the animal)</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-header">ESG Pre-filter Classifier</div>
            <div class="card-body">
                <p><strong>Model:</strong> Logistic Regression + TF-IDF/LSA</p>
                <p><strong>Test F2:</strong> 0.931</p>
                <p><strong>Recall:</strong> 100%</p>
                <p class="text-muted mb-0">Identifies ESG content before detailed classification</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Source Code

<a href="https://github.com/frederick-douglas-pearce/sportswear-esg-news-classifier" class="btn btn-outline-primary">
  <i class="fab fa-github"></i> View on GitHub
</a>
