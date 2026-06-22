# AOI Comparison

AOI Comparison in GazePlotter provides quantitative analysis of eye-tracking data through bar charts. It aggregates gaze metrics across Areas of Interest (AOIs) for statistical comparison and analysis.

![AOI Comparison showing aggregated AOI metrics for a selected stimulus.](/docs/images/eyetracking-bar-plot-gazeplotter.jpg)

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/setup/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/setup/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/setup/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/setup/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/setup/workspace/#removing-a-plot)

## Metric Contract

To render an AOI Comparison plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `aoi-vector` (computes a value or distribution for each Area of Interest individually).
- **Windowing**: `forbidden` (calculated across the selected time range as a single aggregate).

> **Metrics Documentation**: For details on how these raw metrics are calculated, see [Fixation & Dwell Durations](/docs/metrics/durations) and [Gaze Counts & Latency](/docs/metrics/counts-latency).

## Configuration via Settings Pane

Clicking the AOI Comparison plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed as bars in the chart.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and dimensions.

### Participant group
Filter the eye-tracking data by group or individual participant.
- **Select group**: A dropdown containing *All participants* and any custom participant groups defined.
- **Edit groups…**: Opens the Participant Groups modal to create or modify comparative groups.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

### Metric
Configure the quantitative metric displayed on the value axis.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `aoi-vector` shape contract. Standard metrics include:
  - *Time on AOI* (`absoluteTime`): Total duration spent looking within the boundary (see [Durations](/docs/metrics/durations)).
  - *Relative time on AOI* (`relativeTime`): Proportion of total time spent in each AOI (see [Durations](/docs/metrics/durations)).
  - *Visit count per AOI* (`visitCount`): Number of distinct entries into the boundary (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit duration* (`visitDuration`): Average duration of visits (consecutive fixations) (see [Durations](/docs/metrics/durations)).
  - *Fixation count per AOI* (`fixationCount`): Number of fixations within the boundary (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Average fixation duration* (`fixationDuration`): Mean length of individual fixations (see [Durations](/docs/metrics/durations)).
  - *Time to first fixation* (`timeToFirstFixation`): Average latency until initial entry (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *First fixation duration* (`firstFixationDuration`): Mean length of the first fixation (see [Durations](/docs/metrics/durations)).
- **Edit metric library…**: Opens the Metric Library modal where you can customize parameters or define entirely new **custom metrics** to calculate across the AOIs.

### Visualisation
Configure the visual layout and rendering options for the bar chart.
- **Statistical overlay**: Render statistical summaries over the raw data bars:
  - *None*: Shows only the mean bars.
  - *Mean ± 95% CI*: Draws error bars showing the 95% Confidence Interval.
  - *Mean ± SD*: Draws error bars showing the Standard Deviation.
  - *Boxplot*: Overlays a standard box-and-whisker plot mapping the quartile distribution.
- **Orientation**: Select *Horizontal* (default) or *Vertical* bar layout.
- **Order by**: Sort bars by *Value* or by *AOI order*.
- **Direction**: Sort bars ascending (*ASC*) or descending (*DESC*).
- **Scale range**: Explicitly set the value axis minimum and maximum (*0 = Auto*).
- **Hide data**: Check *No AOI data* to hide participants who have zero registered fixations/events across all AOIs.

### Time range [ms]
Filter the temporal range from which fixations and saccades are fetched.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are rendered in the bar chart.
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, rename, or color-code AOIs.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the bar plot.
  - *File formats*: PNG (transparent background) or JPG (white background).
  - *Dimensions*: Customizable width (height maintains a 5:3 aspect ratio).
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable top, right, bottom, left margins.
  - *Preview*: Live render of the output before saving.
- **Export Data**: To export raw statistical values in CSV format for R, Python, SPSS, or other analytical software, see the [Aggregated Data Export](/docs/export/aggregated-data/) documentation.

## Interpretation

Use AOI Comparison to:
- **Compare AOI performance**: Identify which areas attract most/least attention.
- **Quantify differences**: Obtain precise measurements rather than visual estimates.
- **Perform group comparisons**: Analyze how different participant groups behave comparative to each other.
- **Conduct statistical analysis**: Export exact computed metric values per participant for further processing.
