# Time-binned AOI Occupancy

Time-binned AOI Occupancy in GazePlotter provides a continuous visualization of how visual attention is distributed across Areas of Interest (AOIs) over time. By segmenting the timeline into discrete bins, this plot reveals the dynamic flow and density of participants' gaze, making it easier to identify peak attention periods and shifts between AOIs.

<!-- ![](/docs/images/eyetracking-aoi-stream-gazeplotter.jpg) -->

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/setup/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/setup/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/setup/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/setup/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/setup/workspace/#removing-a-plot)

## Metric Contract

To render a Time-binned AOI Occupancy plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `aoi-vector` (computes a value or distribution for each Area of Interest individually).
- **Windowing**: `required` (must specify a window/bin size and step size to calculate the time course of attention).

> **Metrics & Windowing Documentation**: For details on windowed calculations and Svelte-side frame math (like sub-bin overlap vs. midpoint-gating), see the [Metrics Library Overview](/docs/metrics), [Fixation & Dwell Durations](/docs/metrics/durations), and [Gaze Counts & Latency](/docs/metrics/counts-latency).

## Configuration via Settings Pane

Clicking the Time-binned AOI Occupancy plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed in the occupancy plot.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and dimensions.

### Participant group
Filter the eye-tracking data by group.
- **Select group**: A dropdown containing *All participants* and custom participant groups.
- **Edit groups…**: Opens the Participant Groups modal to create or modify comparative groups.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

### Metric
Configure the quantitative metric calculated inside each time bin.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the windowed `aoi-vector` contract. Standard metric templates include:
  - *Time on AOI* (`absoluteTime-aoi-windowed-500`): Total duration spent looking within the boundary per bin (see [Durations](/docs/metrics/durations)).
  - *Relative time on AOI* (`relativeTime-aoi-windowed-500`): Proportion of time spent in each AOI relative to the bin size (see [Durations](/docs/metrics/durations)).
  - *Fixation count per AOI* (`fixationCount-aoi-windowed-500`): Number of fixations registered in each AOI per bin (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit count per AOI* (`visitCount-aoi-windowed-500`): Number of visits registered in each AOI per bin (see [Counts & Latency](/docs/metrics/counts-latency)).
- **Edit metric library…**: Opens the Metric Library modal where you can customize bin sizes (window size and step size) or define **custom windowed metrics**.

### Visualisation
Configure the visual layout and alignment.
- **Select view**: Choose how the time-binned data is visually arrayed:
  - *Stream*: A centered, flowing river-like visualization. Highlights the shifting volume of attention across AOIs without pinning data to a flat baseline, making broad temporal trends easily visible.
  - *Distribution*: A stacked area chart using a flat zero-baseline. Tracking the exact proportion or total occupancy of specific AOIs over time is easier.
  - *Ridgeline*: Overlapping density curves for each AOI, resembling a mountain range. Excellent for comparing peak attention times across AOIs independently.
  - *Heatmap*: A grid-based visualization where rows represent AOIs and color intensity represents the proportion of attention during each bin.
- **Ridge scale** (visible only when *Ridgeline* is selected): Controls the vertical overlap (scale factor) between adjacent AOI density "mountains" (from 1 to 10).
- **Color scale picker** (visible only when *Heatmap* is selected): Select the minimum, middle, and maximum colors for the heatmap intensity gradient.
- **Hide data**: Check *No AOI data* to hide participants who have zero registered fixations/events across all AOIs.

### Time range [ms]
Filter the temporal range from which data is fetched.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are rendered.
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, rename, or color-code AOIs.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the plot.
  - *File formats*: PNG (recommended, transparent background) or JPG (white background).
  - *Dimensions*: Customizable width (height calculated automatically based on contents).
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable margins.
  - *Preview*: Live render of the output before saving.

## Interpretation

Use Time-binned AOI Occupancy to:
- **Analyze attention shifts**: Observe when participants collectively move their gaze from one AOI to another.
- **Identify peak engagement**: Pinpoint the exact moments when specific features receive maximum visual attention.
- **Compare group synchrony**: Assess whether different participant groups exhibit distinct or synchronized gaze behaviors over time.
- **Evaluate temporal distribution**: Gauge whether an AOI receives sustained attention or quick, concentrated bursts.
