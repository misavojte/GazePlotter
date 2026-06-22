---
title: Metrics Library Overview
order: 1
---

# Metrics Library Overview

The **Metrics Library** is GazePlotter's central engine for configuring, calculating, and managing eye-tracking metrics. Rather than hardcoding metric logic into specific visualizers, GazePlotter uses a unified Domain-Specific Language (DSL) that decoupling mathematical calculations from the UI's display formats. 

This architecture allows you to instantiate, parameterize, and project quantitative eye-tracking metrics globally, making the same underlying data available to any compatible visualization or data export pipeline.

---

## Core Architecture

Every metric instance in GazePlotter is constructed from three distinct configuration layers:

1. **Base Recipe**: The core mathematical calculation performed on raw fixation data (e.g., summing fixation durations, counting transitions, or aligning scanpaths).
2. **Parameters**: Recipe-specific inputs that tune the calculation (e.g., transition mode, Markov step counts, or string alignment thresholds).
3. **Data Projection**: Rules that reshape the raw outputs of a recipe into structures compatible with specific visualizations, including time-based windowing and binning.

---

## Output Shapes and Projections

Different plots require different dimensional formats. For example, a bar chart needs a list of values per Area of Interest (AOI), while a correlation plot needs single scalar values per participant. 

The projection layer defines how raw values computed by a recipe translate to these target shapes.

### Raw vs. Projected Shapes

Recipes calculate values into four canonical **Raw Shapes**:
- `scalar`: A single numerical value per participant (e.g., Recurrence Rate).
- `aoi-vector`: An array of values mapping to each active AOI slot (e.g., Dwell Time per AOI).
- `aoi-pair-matrix`: A 2D grid of values mapping transitions between AOI pairs (e.g., Transition Probability).
- `participant-pair-matrix`: A 2D grid representing pairwise comparisons between participants (e.g., Scanpath Similarity).

Projections act as a transformation tree, using **Leaf Projections** to reshape raw outputs into other shapes. The system supports the following leaf kinds:

| Leaf Projection Kind | Source Raw Shape | Output Shape | Description |
| --- | --- | --- | --- |
| `identity-scalar` | `scalar` | `scalar` | Passes the scalar value through directly. |
| `identity-aoi-vector` | `aoi-vector` | `aoi-vector` | Passes the AOI vector through directly. |
| `identity-aoi-pair-matrix` | `aoi-pair-matrix` | `aoi-pair-matrix` | Passes the N×N transition matrix through directly. |
| `identity-participant-pair-matrix` | `participant-pair-matrix` | `participant-pair-matrix` | Passes the M×M similarity matrix through directly. |
| `pick-aoi` | `aoi-vector` | `scalar` | Extracts a single target AOI value from the vector. |
| `pick-any-fixation` | `aoi-vector` | `scalar` | Extracts the total stimulus-level value (any fixation). |
| `aggregate-aoi` | `aoi-vector` | `scalar` | Reduces the vector using `max` or `min` across AOIs. |
| `matrix-diagonal` | `aoi-pair-matrix` | `aoi-vector` | Extracts the diagonal cells (self-transitions) as a vector. |
| `matrix-row` | `aoi-pair-matrix` | `aoi-vector` | Extracts a row (outgoing transitions from a source AOI) as a vector. |
| `matrix-col` | `aoi-pair-matrix` | `aoi-vector` | Extracts a column (incoming transitions to a target AOI) as a vector. |
| `matrix-cell` | `aoi-pair-matrix` | `scalar` | Extracts a single transition cell (`fromAoi` &gt; `toAoi`) as a scalar. |
| `matrix-aggregate` | `aoi-pair-matrix` | `scalar` | Reduces all cells to a scalar using a reducer (`sum`, `mean`, `max`, `min`). |


## Windowing and Binning Rules

A projection can also wrap a leaf projection in a temporal or ordinal window to compute time-series data. The window is defined by:
- **Window size**: The duration of the analysis interval (e.g., 500 ms or 50 fixations).
- **Step size**: The offset between consecutive intervals. If the step size equals the window size, the timeline is divided into adjacent, non-overlapping bins. If the step size is smaller, the window slides, creating overlapping bins that smooth the time-series.

### Svelte-Side Frame Mathematics

To compute windowed values accurately, GazePlotter projects fixations onto moving time windows using two distinct scientific signals:

1. **Sub-bin Overlap Duration (`frame.duration`)**:
   Computed as `min(fixation.end, window.end) - max(fixation.start, window.start)`. 
   This matches the legacy overlap math exactly. It is used for duration metrics (like `absoluteTime` and `relativeTime`) so a fixation crossing a window boundary contributes only its in-window portion, ensuring the sum of windowed values equals the total unwindowed dwell time.
   
2. **Midpoint-in-Window Membership (`frame.midpointInWindow`)**:
   A fixation belongs to a window if its temporal midpoint (`start + duration / 2`) falls within the window's boundaries.
   This is used to gate count-style metrics (like `fixationCount` and `visitCount`) and RQA metrics so that each fixation contributes to exactly one window, preventing double-counting.

---

## Aggregating Across Participants

When a plot summarizes a whole group, it must combine each participant's value into a single result. Whether a given combination is meaningful is decided by the metric's **measurement class** — a scientific property of the quantity itself, not a setting you have to reason about:

- **Extensive (additive total)** — counts and durations (fixation count, dwell time, transition counts). These are physical totals, so across participants they can be shown as a **per-participant mean** or as a **cohort total** (a sum that grows with the group and tapers honestly as participants drop out of late time windows).
- **Intensive (normalized)** — rates, shares, probabilities, and averages (relative dwell time, mean fixation duration, transition probability, RQA measures). Each value is already normalized per participant, so across participants it is shown as a **mean**; a cohort total is not meaningful, because adding percentages or averages together has no physical interpretation.
- **Proportion** — a per-participant yes/no outcome (e.g. whether an AOI was fixated). Across participants this becomes the fraction of the group that met the condition (a rate), drawn as a proportional bar.
- **Group-level** — a quantity defined by a *pair* of participants (scanpath similarity). There is no per-participant value to combine; the comparison matrix is itself the across-participant result.

The measurement class determines which options a plot exposes. In a plot that reduces the group to one value per cell (AOI Timeline, Transition Matrix), an additive metric lets you pick a per-participant mean or a cohort total, while a normalized metric simply averages. You never have to choose an unsound combination — only the meaningful options are offered.

---

## Customizing the Metric Library

To manage the Metric Library, click **Edit metric library…** in any collapsible Settings Pane or the data export panel.

### Editing Metric Instances
1. **Select or Duplicate**: Select an existing metric in the left sidebar, or click **Duplicate** to use it as a template for a new custom metric.
2. **Set Parameters**: Configure recipe-specific fields (e.g., toggle transition modes, edit Markov step limits, or modify RQA thresholds).
3. **Choose Projection**: Select the target projection and determine whether it is non-windowed (Aggregate) or windowed (Binned). If windowed, configure the window and step sizes.
4. **Label and Save**: Provide a unique, descriptive label for the instance (e.g., "Absolute Dwell (1000ms bins / 200ms step)") and click **Save changes**. The new metric will instantly appear in all compatible dropdown selections in the workspace.
