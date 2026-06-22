---
title: Brain–Computer Interface Signal Pipelines
date: 2025-12-01
tags:
  - engineering
  - research
summary: EEG pipelines for P300, motor imagery, and SSVEP — including 87.8% motor imagery classification in Columbia’s BCI Lab.
draft: false
---

## Overview

Work in Columbia’s **Brain–Computer Interfaces Lab** (Fall 2025): collecting EEG data and building classification pipelines for multiple paradigms used in non-invasive BCIs.

## Technical work

- **Motor imagery:** Common Spatial Pattern (CSP) filtering and classifier tuning — **87.81%** accuracy on our held-out evaluation
- **P300:** Event-related potential detection pipeline for spellers / selection tasks
- **SSVEP:** Steady-state visual evoked potential analysis for frequency-coded targets

## Why it matters

BCI sits at the intersection of signal processing, neuroscience, and human-computer interaction — the same “signals → model → action” loop I use in genomics and health analytics, applied to neural data.

## Stack

Python, MNE-style preprocessing patterns, scikit-learn, feature extraction and cross-validation for small-N EEG datasets.
