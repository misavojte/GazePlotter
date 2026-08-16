# Event Metrics

Event metrics quantify the recording along its event axis: not what the eyes were doing but what was happening around them, as carried by uploaded [event data](/docs/upload-data/events/) (dynamic AOI visibility periods, task markers, derived interval channels). The channel axis follows the [Event Library](/docs/workspace/event-library/): one slot per displayed name, so channels merged under one name are measured as one.

Event channels are defined per stimulus, unlike eye-movement types. Every event metric therefore computes against the channel table of the plot's stimulus, and a channel picked by name resolves per stimulus: on a stimulus without that channel the reading reports no value.

Event metrics appear in the Metric Library whenever the library is open, but they only produce values on datasets that carry event data.

---

## Output Shape and Projections Translation

All event metrics output an `event-vector` (an array of values mapping to each event channel of the stimulus).

### 1. Vector Passthrough (`event-vector`)
You can pass the vector through directly to analyze all channels simultaneously:
- **Identity (`identity-event-vector`)**: Outputs the array of values for every channel slot.

> **Visualizer Compatibility**: Passing the raw vector through allows you to select the metric in the [Event Comparison](/docs/visualizations/event-comparison/) plot (non-windowed, distribution overlays).

### 2. Translating Vector to Scalar (`scalar`)
You can reduce the vector into a single numerical value:
- **Pick channel (`pick-event`)**: Extracts the value of a single channel by its displayed name (e.g. time a dynamic AOI was visible). For metrics built on a per-occurrence sample (Event Duration), the pick also carries the summary statistic (mean, median, max, min).

> **Visualizer Compatibility**: Projecting to a scalar allows you to select the metric in the [Metric Correlation](/docs/visualizations/metric-correlation/) and [Metric Matrix](/docs/visualizations/metric-matrix/) plots (non-windowed) or the [Metric Timeline](/docs/visualizations/metric-timeline/) plot (windowed, timeseries). Note that `eventLatency` forbids windowing and is incompatible with the Metric Timeline.

---

## Shared Semantics

Three properties of event data shape every recipe below:

- **Instant markers** (duration 0) are real occurrences. They count in Event Count and Time to First Event, contribute a genuine 0 ms sample to Event Duration, and add nothing to Event Time or Event Time Share.
- **Overlap is honest, not merged.** Occurrences on one channel may overlap (channels merged under one displayed name concatenate their occurrence lists). Each occurrence counts in full, so a channel's total time can exceed the range and its time share can exceed 100. An occurrence can also outlast the gaze recording, with the same effect on an unbounded share.
- **Absence semantics.** A participant with no occurrences on a channel reads 0 for counts and times and no value (NaN) for durations and latency. A stimulus without event channels has an empty axis, and a `pick-event` reading there reports no value.

---

## Metric Recipes

GazePlotter supports five recipes on the event axis:

### 1. Event Count (`eventCount`)
The number of occurrences active on each channel within the analyzed range, instant markers included.

- **Raw Shape**: `event-vector`
- **Unit**: `count`
- **Windowing**: Supported. An occurrence counts in every window it is active in, so a long occurrence appears in each window it spans and per-window values read as concurrent activity ("how many occurrences are happening here"), never as shares of a total. An instant is active only at its moment, so it lands in exactly one window of a tiling.
- **Bounds**: A bounded range counts the occurrences overlapping it, whether they start inside it or merely reach into it.
- **Measurement class**: Extensive; across participants the reduced value is a per-participant mean or a cohort total.

### 2. Event Time (`eventTime`)
The total time (in milliseconds) each channel is active.

- **Raw Shape**: `event-vector`
- **Unit**: `ms`
- **Windowing**: Supported. Contributions clip to the window, so windowed values compose to the unwindowed total.
- **Measurement class**: Extensive (additive total). Overlapping occurrences each count in full (see Shared Semantics).

### 3. Event Time Share (`eventTimeShare`)
The share (%) of the recording (or of the bounded range / window) each channel is active.

- **Raw Shape**: `event-vector`
- **Unit**: `%`
- **Windowing**: Supported. Each window's share is of that window's own size.
- **Measurement class**: Intensive (normalized). Can exceed 100 on overlapping occurrences or occurrences outlasting the gaze recording (see Shared Semantics). NaN when the scan has no extent.

### 4. Event Duration (`eventDuration`)
The duration (in milliseconds) of individual occurrences on each channel, collapsed per participant (mean unless a summary projection chooses otherwise).

- **Raw Shape**: `event-vector`
- **Unit**: `ms`
- **Windowing**: Supported. Durations are the actual occurrence lengths; membership is by overlap.
- **Measurement class**: Intensive (normalized). Distribution plots pool the raw per-occurrence sample instead of the collapse. A pure marker channel yields an all-zero sample, which is the honest reading of instants.

### 5. Time to First Event (`eventLatency`)
The elapsed time (in milliseconds) from the start of the stimulus timeline (time = 0) to the first occurrence on each channel.

- **Raw Shape**: `event-vector`
- **Unit**: `ms`
- **Windowing**: Forbidden (`supportsWindowing: false`). Latency is a stimulus-lifetime concept. A plot's time-range bound narrows which occurrences are scanned but does not re-zero the clock: the first in-range occurrence reports its true onset, which can lie before the range start when the occurrence straddles it.
- **Invariants**: A channel that never occurs for the participant returns NaN, never 0; a value of 0 means an occurrence genuinely starts at time zero. Event files may carry negative onsets, and they are reported as-is.
- **Measurement class**: Intensive (normalized).
- **Time-base note**: Event files share the gaze data's timeline, so what time zero means follows the same source rules as [Time to First Eye Movement](/docs/metrics/eye-movement/).
