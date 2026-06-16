# Metric Timeline

Metric Timeline in GazePlotter provides a temporal visualization of how eye-tracking metrics evolve across a stimulus timeline. By calculating scalar metrics within moving temporal windows, this plot shows trends, patterns, and fluctuations in visual attention and processing load over time, rendered either as a color-coded heatmap grid or a multi-line line chart overlay.

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/setup/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/setup/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/setup/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/setup/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/setup/workspace/#removing-a-plot)

## Metric Contract

To render an Metric Timeline plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `scalar` (computes a single numerical value per temporal window).
- **Windowing**: `required` (must specify a window/bin size and step size to trace the metric value sequentially over the timeline).

> **Metrics & Windowing Documentation**: For details on how raw metric shapes translate to windowed scalar projections, see the [Metrics Library Overview](/docs/metrics) and category sub-pages.

## Configuration via Settings Pane

Clicking the Metric Timeline plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Gaze data will be filtered and binned along this stimulus's recorded timeline.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and dimensions.

### Participant group
Filter the analysis by participant group.
- **Select group**: A dropdown containing *All participants* and custom participant groups.
- **Edit groups…**: Opens the Participant Groups modal to create or modify comparative groups.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

### Metric
Configure the windowed scalar metric to track.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the windowed `scalar` contract:
  - *Average fixation duration* (`avgFixationDuration-any-windowed`): Computes the mean duration of fixations landing within each moving window (see [Durations](/docs/metrics/durations)).
  - *Fixation count* (`fixationCount-any-windowed`): Tracks the frequency of fixations per window (see [Counts & Latency](/docs/metrics/counts-latency)).
- **Edit metric library…**: Opens the Metric Library modal where you can customize window parameters (window size and step size, e.g. 1000ms window with 100ms step) or define **custom windowed scalar metrics**.

### Visualisation
Configure the visual presentation format:
- **Select view**:
  - *Heatmap*: Renders a grid where rows represent participants (or participant averages) and columns represent time bins. Cell color represents the metric value.
  - *Overlay*: Renders a line graph where the horizontal axis is time and the vertical axis is the metric value, overlaying participant or group trend lines.
- **Color scale picker** (visible only in *Heatmap* presentation): Select the minimum, middle, and maximum colors for the heatmap intensity gradient.

### Time range [ms]
Filter the temporal range.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are active for the metric calculation. If AOIs are selected, the metric is computed only using fixations that land within those active AOIs.
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, rename, or color-code AOIs.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the plot.
  - *File formats*: PNG (recommended, transparent background) or JPG (white background).
  - *Dimensions*: Restructures width and height to fit content.
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable margins.
  - *Preview*: Live render of the output before saving.

## Interpretation

Use Metric Timeline to:
- **Track cognitive processing load**: An increase in average fixation duration over a timeline segment can indicate areas of high visual complexity or cognitive load.
- **Observe search trends**: Track when participants are scanning rapidly (low fixation duration, high count) vs. processing deeply (high fixation duration).
- **Compare group responses**: Overlay trend lines for custom groups to see if different demographics exhibit distinct temporal patterns during stimulus presentation.
