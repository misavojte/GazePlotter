---
title: Gaze Counts & Latency
order: 3
---

# Gaze Counts & Latency

Count-based metrics quantify how often a participant returns to or interacts with specific regions, while latency metrics measure the speed of initial attraction.

---

## Output Shape and Projections Translation

All count and latency metrics naturally output an `aoi-vector` (an array of values mapping to each active AOI, plus `noAoi` and `anyFixation` sentinel slots). Using GazePlotter's projection algebra, you can translate this raw vector into a scalar, making count and latency metrics compatible with different visualizers.

### 1. Vector Passthrough (`aoi-vector`)
You can pass the vector through directly to analyze the values for all Areas of Interest (AOIs) simultaneously:
- **Identity (`identity-aoi-vector`)**: Outputs the array of counts or latencies for all active AOI slots.

> **Visualizer Compatibility**: Passing the raw vector through allows you to select the metric in the [AOI Comparison](/docs/visualizations/aoi-comparison) plot (non-windowed, aggregate) or the [AOI Timeline](/docs/visualizations/aoi-timeline) (windowed, timeseries). Note that `timeToFirstFixation` forbids windowing and is incompatible with the AOI Timeline.

### 2. Translating Vector to Scalar (`scalar`)
You can reduce the vector into a single numerical value:
- **Pick AOI (`pick-aoi`)**: Extracts the value of a single target AOI (e.g. Fixation Count on AOI A).
- **Pick Any Fixation (`pick-any-fixation`)**: Extracts the total stimulus-wide value from the `anyFixation` sentinel slot.
- **Aggregate AOIs (`aggregate-aoi`)**: Reduces all active AOI cells into a single scalar using a reducer (`max` or `min`).

> **Visualizer Compatibility**: Projecting a count/latency vector into a scalar allows you to select it in the [Metric Correlation](/docs/visualizations/metric-correlation) plot (non-windowed, aggregate) or the [Metric Timeline](/docs/visualizations/metric-timeline) plot (windowed, timeseries).

---

## Metric Recipes

GazePlotter supports three core recipes for counts and latencies:

### 1. Fixation Count (`fixationCount`)
The total number of separate fixations landing within each Area of Interest (AOI).

- **Raw Shape**: `aoi-vector`
- **Unit**: `count`
- **Windowing**: Supported. Gated by midpoint-in-window membership (`frame.midpointInWindow`). A fixation is counted in a window if and only if its midpoint falls within the window's boundaries. This ensures that fixations are never counted twice across sliding/overlapping windows.
- **Scientific Meaning**: Indicates the importance or relevance of an AOI. A higher fixation count suggests that the region was repeatedly inspected or required substantial visual attention.

### 2. Visit Count (`visitCount`)
The number of times a participant entered and exited an AOI. A visit consists of a sequence of one or more consecutive fixations within the same AOI.

- **Raw Shape**: `aoi-vector`
- **Unit**: `count`
- **Windowing**: Supported. Like fixation counts, visits are gated by the temporal midpoint of their component fixations to prevent boundary double-counting.
- **Invariants**: Consecutive fixations in the same AOI are collapsed into a single visit. Gaze must leave the AOI (either to another AOI or to off-AOI space) and return for a new visit to be counted.
- **Scientific Meaning**: Reflects search-and-compare behaviors. A high visit count with short visit durations suggests the participant was toggling back and forth to compare information across regions.

### 3. Time to First Fixation (`timeToFirstFixation` / TTFF)
The elapsed time (in milliseconds) from stimulus onset (time = 0) until the onset of the very first fixation landing within a target AOI.

- **Raw Shape**: `aoi-vector`
- **Unit**: `ms`
- **Windowing**: Forbidden (`supportsWindowing: false`). Latency is a stimulus-lifetime concept. A rolling window would calculate "time to first fixation within this window" (which is just relative entry latency), which violates the standard eye-tracking definition.
- **Invariants**: AOIs never fixated return `NaN`. Callers that require a numeric fallback (like CSV export pipelines) represent unvisited slots as `-1`.
- **Scientific Meaning**: A measure of visual salience. AOIs with low TTFF values are highly salient and captured the participant's attention first, either due to bottom-up visual features (e.g., high contrast, bright colors) or top-down task goals.
