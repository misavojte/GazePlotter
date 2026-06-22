---
title: Fixation & Dwell Durations
order: 2
---

# Fixation & Dwell Durations

Duration-based metrics capture the temporal aspect of attention, measuring how long a participant's gaze remained focused on particular Areas of Interest (AOIs) or the stimulus as a whole.

---

## Output Shape and Projections Translation

All duration metrics naturally output an `aoi-vector` (an array of values mapping to each active AOI, plus `noAoi` and `anyFixation` sentinel slots). Using GazePlotter's projection algebra, you can translate this raw vector into a scalar, making duration metrics compatible with different visualizers.

### 1. Vector Passthrough (`aoi-vector`)
You can pass the vector through directly to analyze the values for all Areas of Interest (AOIs) simultaneously:
- **Identity (`identity-aoi-vector`)**: Outputs the array of durations for all active AOI slots.

> **Visualizer Compatibility**: Passing the raw vector through allows you to select the metric in the [AOI Comparison](/docs/visualizations/aoi-comparison) plot (non-windowed, aggregate) or the [AOI Timeline](/docs/visualizations/aoi-timeline) (windowed, timeseries).

### 2. Translating Vector to Scalar (`scalar`)
You can reduce the vector into a single numerical value:
- **Pick AOI (`pick-aoi`)**: Extracts the duration value of a single target AOI (e.g. Absolute Dwell on AOI A).
- **Pick Any Fixation (`pick-any-fixation`)**: Extracts the total stimulus-wide value from the `anyFixation` sentinel slot.
- **Aggregate AOIs (`aggregate-aoi`)**: Reduces all active AOI cells into a single scalar using a reducer (`max` or `min`).

> **Visualizer Compatibility**: Projecting a duration vector into a scalar allows you to select it in the [Metric Correlation](/docs/visualizations/metric-correlation) plot (non-windowed, aggregate) or the [Metric Timeline](/docs/visualizations/metric-timeline) plot (windowed, timeseries).

---

## Metric Recipes

GazePlotter provides five core recipes for duration analysis:

### 1. Absolute Dwell Time (`absoluteTime`)
The total cumulative time (in milliseconds) that a participant's gaze dwelled within each active AOI.

- **Raw Shape**: `aoi-vector`
- **Unit**: `ms`
- **Windowing**: Supported. Uses sub-bin overlap duration (`frame.duration`) so that fixations spanning across a window boundary only contribute their in-window portions to the respective bins.
- **Sentinels**: Writes to `noAoiSlot` (index `aoiCount`) for off-AOI fixations, and `anyFixationSlot` (index `aoiCount + 1`) for stimulus-wide totals.
- **Measurement class**: Extensive (additive total). Across participants, show a per-participant mean or a cohort total (the sum of everyone's dwell time).
- **Scientific Meaning**: A general index of visual attention or processing time. Higher values represent a higher volume of information extraction.

### 2. Relative Dwell Time (`relativeTime`)
Dwell time per AOI expressed as a percentage of the participant's total fixation time on the stimulus.

- **Raw Shape**: `aoi-vector`
- **Unit**: `%`
- **Windowing**: Supported. Uses sub-bin overlap duration.
- **Invariants**: Normalised by `anyFixationSlot` total, not the sum across AOI slots (which would double-count multi-tagged fixations and halve the reported percentages).
- **Measurement class**: Intensive (normalized). Each value is already a per-participant share (0–100%), so across participants it is averaged; a cohort total is not offered, because summing shares has no physical meaning. For a group total of attention, use Absolute Dwell Time with its cohort total instead.
- **Scientific Meaning**: Normalises attention across participants with different overall scan durations, making comparison of spatial focus independent of scanning speed.

### 3. Mean Fixation Duration (`fixationDuration`)
The arithmetic mean length of individual fixations.

- **Raw Shape**: `aoi-vector`
- **Unit**: `ms`
- **Windowing**: Supported.
- **Invariants**: Uses the actual, unclipped fixation durations (`fix.duration`) instead of window-frame clipped durations. This preserves the cognitive reality of the fixation event; a windowed slice calculates the mean of actual fixations whose midpoints fall within that window.
- **Measurement class**: Intensive (normalized). The value is already a per-participant average, so across participants it is averaged; a cohort total is not meaningful. For total dwell, use Absolute Dwell Time.
- **Scientific Meaning**: Long average fixations are associated with high cognitive load, difficulty in extracting information, or detailed focus. Short average fixations suggest rapid visual exploration.

### 4. First Fixation Duration (`firstFixationDuration`)
The duration (in milliseconds) of the very first fixation recorded within a target AOI.

- **Raw Shape**: `aoi-vector`
- **Unit**: `ms`
- **Windowing**: Forbidden (`supportsWindowing: false`). "First" is a stimulus-lifetime concept; rolling windows would redefine "first" for every bin, which contradicts standard eye-tracking research paradigms.
- **Invariants**: AOIs never fixated return `NaN`.
- **Measurement class**: Intensive (normalized). A single sampled per-participant duration, averaged across participants.
- **Scientific Meaning**: Often interpreted as an index of initial processing depth or "first-pass" cognitive impact upon first landing on an object.

### 5. Visit Duration (`visitDuration`)
The average duration of distinct entries (visits) into an AOI boundary. A "visit" is defined as a sequence of one or more consecutive fixations within the same AOI before the gaze exits to another area or off-AOI space.

- **Raw Shape**: `aoi-vector`
- **Unit**: `ms`
- **Windowing**: Supported.
- **Invariants**: Collapses consecutive fixations within the same AOI first to calculate distinct visits. 
- **Measurement class**: Intensive (normalized). A per-participant average visit length, averaged across participants. For total dwell, use Absolute Dwell Time.
- **Scientific Meaning**: Measures the cohesion of visual processing. Longer average visit durations imply that once a participant enters a region, they stay to process it thoroughly, whereas short visit durations suggest repeated brief scanning visits.
