# Metric Timeline

A Metric Timeline shows how an eye-tracking metric changes over the course of a stimulus. The metric is computed in a moving time window, for example the average fixation duration in each 1000 ms window, stepped forward every 100 ms. Each participant's values are drawn either as one row of a color-coded heatmap or as one line in a line chart, so trends, patterns, and fluctuations in visual attention and processing load become visible over time.

![Metric Timeline card in the workspace: average fixation duration per participant in a moving window over the Yarbus Remember clothes stimulus.](/docs/images/metric-timeline.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection |
| **Input** | Fixations on the stimulus, within the time range and AOI selection |
| **Metric Library** | One windowed `scalar` metric, computed per participant (see [Metrics](/docs/metrics)) |

## When to Use It

- **Track cognitive processing load**: An increase in average fixation duration over a timeline segment can indicate areas of high visual complexity or cognitive load.
- **Observe search trends**: Track when participants are scanning rapidly (low fixation duration, high count) vs. processing deeply (high fixation duration).
- **Compare participants with the group**: In the *Overlay* view, each participant's line runs against the mean line and the band between the 25th and 75th percentiles.

## Reading the Plot

- **Horizontal axis**: elapsed time in milliseconds. The axis title names the window and the step, for example *1000 ms window, 100 ms step*. Each value is placed at the middle of its window.
- **Heatmap view**: one row per participant. Cell color is the metric value in that window; the color bar below the plot is titled with the metric's label and unit. Gray cells are windows with no value, such as a window without fixations or one past the end of a recording.
- **Overlay view**: the vertical axis is the metric value. Every participant is a faint line, the red line is the mean across participants, and the red shaded band spans the 25th to 75th percentile.

## Add a Metric Timeline

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Per participant** > **Metric Timeline**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first, then the **Metric**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Gaze data will be filtered and binned along this stimulus's recorded timeline.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the analysis by participant selection.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the windowed scalar metric to track. The metric must compute a single value per window (output shape `scalar`, windowing `required`); for how raw metric shapes become windowed scalar projections, see the [Metrics Library Overview](/docs/metrics) and its category pages.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the windowed `scalar` contract:
  - *Average fixation duration* (`avgFixationDuration-any-windowed`): Computes the mean duration of fixations landing within each moving window (see [Durations](/docs/metrics/durations)). This is the default.
  - *Fixation count* (`fixationCount-any-windowed`): Tracks the frequency of fixations per window (see [Counts & Latency](/docs/metrics/counts-latency)).
- **Edit metric library**: Opens the Metric Library modal where you can customize window parameters (window size and step size, e.g. 1000ms window with 100ms step) or define **custom windowed scalar metrics**.

### Visualization
Configure the visual presentation. The view decides which further controls appear; they are listed under the view that reveals them.
- **Select view**:
  - *Heatmap*: Renders a grid where rows represent participants and columns represent time windows. Cell color represents the metric value. This is the default.
    - **Color scale picker**: Minimum, middle, and maximum colors of the heatmap intensity gradient.
  - *Overlay*: Renders a line graph where the horizontal axis is time and the vertical axis is the metric value, with one line per participant, the mean line, and the 25th to 75th percentile band.

### Time range
Filter the temporal range.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are active for the metric calculation. If AOIs are selected, the metric is computed only using fixations that land within those active AOIs.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the timeline plot as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection, time range and AOI selection.

## Interactivity

- **Window under the pointer**: Hovering marks the window and step at the pointer; in the *Overlay* view, the hovered participant's line is emphasised.
- **Linked hovering**: The hovered moment and participant are marked in the other plots of the workspace, and moments and participants hovered elsewhere are marked here, see [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).

## Related

- [AOI Timeline](/docs/visualizations/aoi-timeline/): how attention is split between AOIs over time, instead of one metric.
- [Scarf Plot](/docs/visualizations/scarf-plot/): the raw AOI sequence behind the windowed values.
- [Metric Matrix](/docs/visualizations/metric-matrix/): one whole-recording value per participant and stimulus, without windows.
