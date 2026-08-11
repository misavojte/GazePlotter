# Eye-movement Type Metrics

Eye-movement type metrics quantify the recording along its second axis: not where gaze landed (AOIs) but what the eyes were doing (fixations, saccades, blinks, or any other type the source recorded). The type axis follows the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library): one slot per displayed name, so types merged under one name are measured as one.

A dataset carries only the types its source actually recorded. Fixation-only exports (for example GazePoint or plain CSV fixation lists) have no Saccade type at all; saccade-based readings then report no value rather than an approximation.

---

## Output Shape and Projections Translation

All eye-movement metrics output a `category-vector` (an array of values mapping to each eye-movement type present in the dataset).

### 1. Vector Passthrough (`category-vector`)
You can pass the vector through directly to analyze all types simultaneously:
- **Identity (`identity-category-vector`)**: Outputs the array of values for every type slot.

> **Visualizer Compatibility**: Passing the raw vector through allows you to select the metric in the [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison) plot (non-windowed, distribution overlays).

### 2. Translating Vector to Scalar (`scalar`)
You can reduce the vector into a single numerical value:
- **Pick type (`pick-category`)**: Extracts the value of a single type by its displayed name (e.g. time spent in Saccade segments). For metrics built on a per-event sample (Eye-movement Duration), the pick also carries the summary statistic (mean, median, max, min).

> **Visualizer Compatibility**: Projecting to a scalar allows you to select the metric in the [Metric Correlation](/docs/visualizations/metric-correlation) and [Metric Matrix](/docs/visualizations/metric-matrix) plots (non-windowed) or the [Metric Timeline](/docs/visualizations/metric-timeline) plot (windowed, timeseries). Note that `movementLatency` forbids windowing and is incompatible with the Metric Timeline.

---

## Metric Recipes

GazePlotter supports five recipes on the eye-movement type axis:

### 1. Eye-movement Count (`movementCount`)
The number of segments of each type.

- **Raw Shape**: `category-vector`
- **Unit**: `count`
- **Windowing**: Supported. Each segment counts once, in the window holding its midpoint, so per-window counts sum to the total.
- **Measurement class**: Extensive (additive total).
- **Scientific Meaning**: Basic oculomotor activity. Saccade count tracks scanning effort; blink count relates to workload and fatigue.

### 2. Eye-movement Time (`movementTime`)
The total time (in milliseconds) spent in segments of each type.

- **Raw Shape**: `category-vector`
- **Unit**: `ms`
- **Windowing**: Supported. Contributions clip to the window, so windowed values compose to the unwindowed total.
- **Measurement class**: Extensive (additive total). A type the recording contains no segments of reads 0.
- **Scientific Meaning**: The absolute time budget per type; the category-axis twin of absolute dwell time.

### 3. Eye-movement Time Share (`movementTimeShare`)
The share (%) of the recording (or of the bounded range / window) spent in segments of each type.

- **Raw Shape**: `category-vector`
- **Unit**: `%`
- **Windowing**: Supported. Each window's share is of that window's own size.
- **Measurement class**: Intensive (normalized).
- **Scientific Meaning**: The relative time budget, robust to unequal recording lengths across participants.

### 4. Eye-movement Duration (`movementDuration`)
The duration (in milliseconds) of individual segments of each type, collapsed per participant (mean unless a summary projection chooses otherwise).

- **Raw Shape**: `category-vector`
- **Unit**: `ms`
- **Windowing**: Supported. Durations are the actual segment lengths; membership is by overlap.
- **Measurement class**: Intensive (normalized). Distribution plots pool the raw per-segment sample instead of the collapse.
- **Scientific Meaning**: Typical segment length per type. Mean fixation duration indexes processing depth; saccade duration scales with amplitude.

### 5. Time to First Eye Movement (`movementLatency`)
The elapsed time (in milliseconds) from the start of the stimulus timeline (time = 0) to the start of the first segment of each type. Picked at Saccade this is the time to first saccade: the latency from stimulus onset to eye-movement initiation, commonly called saccadic latency.

- **Raw Shape**: `category-vector`
- **Unit**: `ms`
- **Windowing**: Forbidden (`supportsWindowing: false`). Latency is a stimulus-lifetime concept; a rolling window would measure relative onset within the window, which violates the standard definition. A plot's time-range bound narrows which segments are scanned but does not re-zero the clock: the first in-range segment of a type reports its true onset, which can lie before the range start when the segment straddles it.
- **Invariants**: A type that never occurs returns `NaN`, never 0; a value of 0 means a segment genuinely starts at time zero. The pick lists the dataset's actual type names; the seeded instance picks Fixation (the one type every dataset carries, where the value equals Time to First Fixation's any-fixation reading), so switch it to Saccade for saccadic latency. Fixation-only sources have no Saccade type, so the Saccade pick reports no value rather than a proxy. If you need an arrival-based fallback there, use [Time to First Fixation](/docs/metrics/counts-latency), which overestimates onset latency by the saccade flight time (typically 20-40 ms).
- **Measurement class**: Intensive (normalized). Across participants the reduced value is a mean; latency distributions are right-skewed, so prefer the [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison) plot's median and IQR statistics when comparing groups.
- **Time-base fidelity**: The measurement runs from time zero of the stimulus timeline. Whether that equals true stimulus onset depends on the source. SMI BeGaze trial times and Tobii recordings with interval markers preserve onset; sources GazePlotter rebases to the first recorded sample (Tobii without markers, duration-coded CSV, Varjo, Pupil Cloud) measure from the first sample instead. In a rebased recording that opens with a fixation at time zero, the value equals that first fixation's end; one that opens mid-saccade reads 0.
- **Detector dependence**: Saccade onsets are the source's event-detection output (e.g. an I-VT velocity threshold), so latencies inherit the detector's segmentation. SMI BeGaze exports additionally fold blank category cells into Saccade, which a first-occurrence metric is sensitive to.
- **Scientific Meaning**: Saccadic latency (saccadic reaction time) reflects the speed of oculomotor decision-making. Regular visually guided saccades initiate at roughly 150-250 ms, express saccades at 80-130 ms, and anticipatory movements below about 80 ms. GazePlotter reports the measurement without an anticipatory cutoff (exclusion conventions differ across labs); judge outliers against your own distributions.
