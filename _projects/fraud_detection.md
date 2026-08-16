---
layout: page
title: E-Commerce Fraud Detection
description: Real-time fraud detection with XGBoost and SHAP explainability
img: assets/img/fraud_detection_final_centered.png
importance: 5
category: work
---

## Overview

This project implements a production-ready machine learning system for detecting fraudulent e-commerce transactions in real-time. The system transforms raw transaction data into 30 engineered features and uses an optimized XGBoost classifier to identify fraud while minimizing false positives that could affect legitimate customers.

<div class="mt-5"></div>

## Fraud Detection Capabilities

The system's 30 engineered features enable detection of diverse fraudulent activity patterns:

| Feature Category        | Detection Signals                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Temporal Analysis**   | Unusual transaction timing, timezone mismatches between user location and purchase time, late-hour activity   |
| **Amount Patterns**     | Deviations from typical purchase amounts, micro-transactions indicative of card testing, high-value anomalies |
| **User Behavior**       | Account age relative to transaction patterns, purchase velocity, session characteristics                      |
| **Geographic Risk**     | Distance between user origin and shipping destination, cross-border transactions, location inconsistencies    |
| **Security Indicators** | Composite risk scores combining multiple signals, device and browser fingerprinting patterns                  |

<div class="mt-5"></div>

## Technical Architecture

The pipeline processes transactions through five integrated stages:

<div class="row mt-4">
    <div class="col-12">
        <div class="card">
            <div class="card-body">
                <h3 class="card-title">Feature Engineering</h3>
                <p class="card-text mb-0">Custom sklearn-compatible transformer generates 30 features from 15 raw inputs: timezone-aware temporal features, amount deviations, user behavior metrics, geographic risk indicators, and security composite scores.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Model Inference</h3>
                <p class="card-text mb-0">XGBoost classifier with tuned hyperparameters generates fraud probability scores with P95 latency under 40ms.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Threshold Strategies</h3>
                <p class="card-text mb-0">Five configurable strategies enable precision-recall trade-offs for different business requirements.</p>
            </div>
        </div>
    </div>
</div>

<div class="row mt-3">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">SHAP Explainability</h3>
                <p class="card-text mb-0">TreeSHAP explanations show top risk contributors for each prediction, enabling transparent fraud decisions.</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-body">
                <h3 class="card-title">Deployment</h3>
                <p class="card-text mb-0">FastAPI service containerized with Docker, deployed on Google Cloud Run with auto-scaling.</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Technology Stack

- **ML Pipeline:** Python 3.12, XGBoost, scikit-learn, pandas, numpy
- **Explainability:** SHAP (TreeSHAP for feature importance)
- **API Service:** FastAPI, Uvicorn, Pydantic validation
- **Deployment:** Docker, Google Cloud Run
- **Testing:** pytest (425 tests), Locust (load testing)

<div class="mt-5"></div>

## Model Performance

<div class="row mt-4">
    <div class="col-md-6 mb-3 mb-md-0">
        <div class="card h-100">
            <div class="card-header">Classification Metrics</div>
            <div class="card-body">
                <p><strong>Model:</strong> XGBoost (n_estimators=100, max_depth=4)</p>
                <p><strong>PR-AUC:</strong> 0.866</p>
                <p><strong>ROC-AUC:</strong> 0.976</p>
                <p><strong>F1 Score:</strong> 0.778</p>
                <p class="text-muted mb-0">Trained on 299K transactions with 44:1 class imbalance</p>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-header">Production Performance</div>
            <div class="card-body">
                <p><strong>Precision:</strong> 73.2%</p>
                <p><strong>Recall:</strong> 82.9%</p>
                <p><strong>P95 Latency:</strong> 36ms (Cloud Run)</p>
                <p><strong>Throughput:</strong> 25 requests/second</p>
                <p class="text-muted mb-0">All target metrics exceeded</p>
            </div>
        </div>
    </div>
</div>

<div class="mt-5"></div>

## Source Code

<a href="https://github.com/frederick-douglas-pearce/e-commerce-fraud-detection" class="btn btn-outline-primary">
  <i class="fab fa-github"></i> View on GitHub
</a>
