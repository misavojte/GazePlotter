---
title: Recurrence Quantitative Analysis (RQA)
order: 5
---

# Recurrence Quantitative Analysis (RQA)

Recurrence Quantitative Analysis (RQA) is a non-linear analysis method used to study the dynamical characteristics of scanpaths. By plotting a participant's fixation sequence against itself, GazePlotter identifies recurring visual patterns, periodic revisitations, and dwelling behaviors.

---

## The Recurrence Plot Foundation

RQA metrics are computed from an underlying **Recurrence Plot**, which is a binary matrix `R` where:

```text
R(i, j) = 1   if fixation i and fixation j land on the same area (AOI / Euclidean distance)
R(i, j) = 0   otherwise
```

For details on the visualizer that displays this raw matrix, see [Recurrence Plot](/docs/visualizations/recurrence-plot).

## Output Shape and Projections Translation

All RQA metrics naturally output a `scalar` value representing a global property of the recurrence sequence. Because the raw output is already scalar, no further dimensional projection is required.

### 1. Scalar Passthrough (`scalar`)
You can pass the scalar value through directly to analyze the participant's recurrence rate, determinism, or laminarity:
- **Identity (`identity-scalar`)**: Passes the computed RQA percentage through directly.

> **Visualizer Compatibility**: Passing the raw scalar through allows you to select RQA metrics in the [Metric Correlation](/docs/visualizations/metric-correlation) plot (non-windowed, aggregate) or the [Evolving Metrics](/docs/visualizations/evolving-metrics) plot (windowed, timeseries). RQA metrics cannot be projected to vectors or matrices, so they are not selectable in plots like AOI Metrics or Transition Matrix.

---

## Metric Recipes

GazePlotter provides three RQA metrics:

### 1. Recurrence Rate (`rqaRec`)
The density of recurrence points in the recurrence plot, representing the percentage of fixation pairs that land on the same AOI.

- **Raw Shape**: `scalar`
- **Unit**: `%`
- **Windowing**: Supported (fixation-windowed).
- **Scientific Meaning**: A general index of how repetitive the scanpath is. Higher recurrence rates indicate a gaze pattern that repeatedly returns to previously visited regions.

### 2. Determinism (`rqaDet`)
The percentage of recurrence points that form diagonal lines parallel to the main diagonal (with a minimum line length of 2).

- **Raw Shape**: `scalar`
- **Unit**: `%`
- **Windowing**: Supported (fixation-windowed).
- **Scientific Meaning**: Measures the predictability or regularity of the scanpath. A high determinism score indicates that the participant repeatedly executes the same multi-step sequences of AOI visits (e.g., A &gt; B &gt; C &gt; A &gt; B &gt; C).

### 3. Laminarity (`rqaLam`)
The percentage of recurrence points that form vertical line segments (with a minimum line length of 2).

- **Raw Shape**: `scalar`
- **Unit**: `%`
- **Windowing**: Supported (fixation-windowed).
- **Scientific Meaning**: Indicates the presence of laminar states, where the gaze remains trapped in a specific region or alternates rapidly between overlapping areas. High laminarity points to detailed local inspection or visual dwelling.

---

## Parameters

All RQA metrics share a common parameter:

- **Include Off-AOI Fixations (`include_no_aoi`)**: 
  - `false` (default): Off-AOI fixations (those not falling inside any defined AOI) are skipped entirely. The sequence contains only AOI visits.
  - `true`: Off-AOI fixations participate in the sequence, represented by the `noAoiSlot` sentinel. This allows the system to analyze recurrences that occur outside structured boundaries.

---

## Ordinal Windowing (`windowUnit: 'fixations'`)

Unlike duration-based metrics which slide across time in milliseconds, RQA metrics slice the sequence of events using **ordinal windows** (measured in fixations):

- **Window Size**: The number of consecutive fixations to include in each analysis bin (e.g., 50 fixations).
- **Step Size**: The fixation shift between consecutive bins (e.g., 1 fixation).
- **Inner Leaf**: The inner projection must be `identity-scalar`, yielding a `scalar-timeseries` output shape.

> **Midpoint Membership**: The scan runtime uses midpoint-in-window gating (`frame.midpointInWindow`) to assign each fixation to its respective ordinal bins.
