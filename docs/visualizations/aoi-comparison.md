# AOI Comparison

AOI Comparison puts one metric side by side for every Area of Interest (AOI) on a stimulus, such as dwell time, visit count, or time to first fixation. Each AOI gets its own row of dots, with the mean and its spread drawn over them, so you see both the typical value and how much participants differ.

![AOI Comparison card in the workspace: absolute dwell time per AOI for all participants on the Yarbus Remember clothes stimulus, mean with 95% CI.](/docs/images/aoi-comparison.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection |
| **Input** | One per-AOI metric, computed over the selected time range |
| **Metric Library** | Used: any per-AOI (`aoi-vector`) metric that is not windowed; *Absolute dwell time* by default |

## When to Use It

- **Which AOIs draw attention**: compare dwell time, fixation count, or visit count across AOIs.
- **What is noticed first**: *Time to first fixation* per AOI.
- **How much participants differ**: the spread of the dots shows whether an average hides a split group.
- **Group comparisons**: put two plots side by side with different participant selections.
- **Statistical analysis**: **Download data** exports the computed value of every participant for further processing.

## Reading the Plot

- **Rows**: one per AOI (columns in *Vertical* orientation), plus *No AOI* for fixations outside every AOI unless **Hide No AOI data** is on. By default they follow the AOI order of the [AOI Library](/docs/workspace/aoi-library/).
- **Dots**: one per participant, in the AOI's color. Metrics measured per event, such as *Fixation duration* and *Visit duration*, plot every fixation or visit as its own dot.
- **Overlay**: the black tick is the mean, and the whiskers show its 95% confidence interval by default. **Statistical overlay** switches to standard deviation or a box plot.
- **Value axis**: the metric and its unit, followed by the statistic of the overlay, for example *Absolute dwell time / ms · mean ± 95% CI*. A time range set in the pane is noted there too.
- **Bars**: a yes/no metric such as *Was fixated* draws one plain bar per AOI instead of dots: the share of participants who fixated it.

## Add an AOI Comparison

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Per AOI** > **AOI Comparison**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus**, then the metric under **Metric**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed as rows in the chart.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by group or individual participant.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric displayed on the value axis. For how these metrics are calculated, see [Dwell Time & Fixation Durations](/docs/metrics/durations) and [Fixation Counts & Latency](/docs/metrics/counts-latency).
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `aoi-vector` shape contract (one value or distribution per AOI) and are not windowed (one aggregate over the selected time range). Standard metrics include:
  - *Absolute dwell time* (`absoluteTime`): Total duration spent looking within the boundary (see [Durations](/docs/metrics/durations)).
  - *Relative dwell time* (`relativeTime`): Proportion of total time spent in each AOI (see [Durations](/docs/metrics/durations)).
  - *Visit count* (`visitCount`): Number of distinct entries into the boundary (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit duration* (`visitDuration`): Average duration of visits (consecutive fixations) (see [Durations](/docs/metrics/durations)).
  - *Fixation count* (`fixationCount`): Number of fixations within the boundary (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Fixation duration* (`fixationDuration`): Mean length of individual fixations (see [Durations](/docs/metrics/durations)).
  - *Time to first fixation* (`timeToFirstFixation`): Average latency until initial entry (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *First fixation duration* (`firstFixationDuration`): Mean length of the first fixation (see [Durations](/docs/metrics/durations)).
- **Edit metric library**: Opens the Metric Library modal where you can customize parameters or define entirely new **custom metrics** to calculate across the AOIs.

### Visualization
Configure the layout and the statistical summary.
- **Statistical overlay**: The summary drawn over the dots. Hidden for yes/no metrics, which draw as bars.
  - *None*: Shows only the dots.
  - *Mean ± 95% CI*: The mean with whiskers for its 95% confidence interval (default).
  - *Mean ± SD*: The mean with whiskers for one standard deviation.
  - *Boxplot*: The median, a box from the first to the third quartile, and whiskers to the furthest values within 1.5 × IQR.
- **Orientation**: Select *Horizontal* (default) or *Vertical* layout.
- **Order by**: Sort AOIs by *Value* or by *AOI order* (default).
- **Direction**: Sort *Ascending* or *Descending*.
- **Scale range**: Explicitly set the value axis minimum and maximum (*0 = Auto*).

### Time range
Filter the temporal range from which fixations and saccades are fetched.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are rendered in the chart.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Hide No AOI data**: Drops the No-AOI slot from the chart, so only the named AOIs are compared.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the plot as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection, time range, AOI selection and **Hide No AOI data** setting.

## Interactivity

- **Tooltip**: Hovering a row shows the AOI and the axis value at the pointer. Over dots it lists the participants there (with a count when one participant has several dots); elsewhere in the row it shows n, mean, median, SD, and the 95% CI.

## Related

- [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison/): the same plot along eye-movement types (fixations, saccades, blinks) instead of AOIs.
- [Event Comparison](/docs/visualizations/event-comparison/): the same plot along event channels.
- [Transition Matrix](/docs/visualizations/transition-matrix/): how gaze moves between AOIs, rather than how much it rests in each.
- [Scarf Plot](/docs/visualizations/scarf-plot/): the AOI sequence behind these totals, participant by participant.
