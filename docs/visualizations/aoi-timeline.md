# AOI Timeline

An AOI Timeline shows how visual attention is distributed across Areas of Interest (AOIs) over the course of a stimulus, pooled across a participant selection. The timeline is cut into time bins, a windowed metric is computed for every AOI in every bin, and the result is drawn as a stream, a stacked area, a ridgeline, or a heatmap. Read it to find peak attention periods and the moments when attention shifts from one AOI to another.

![AOI Timeline card in the workspace: summed time on each AOI in a moving window across the Yarbus Remember clothes stimulus.](/docs/images/aoi-timeline.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection, combined into one curve per AOI |
| **Input** | Eye-movement segments with their AOI hits, within the time range |
| **Metric Library** | One metric with the `aoi-vector` output shape (a value for each AOI), with windowing `required`: the metric's window and step sizes set the time bins. Default: *Time on AOI* in 500 ms windows |

## When to Use It

- **Analyze attention shifts**: Observe when participants collectively move their gaze from one AOI to another.
- **Identify peak engagement**: Pinpoint the exact moments when specific features receive maximum visual attention.
- **Compare selection synchrony**: Assess whether different participant selections exhibit distinct or synchronized gaze behaviors over time.
- **Evaluate temporal distribution**: Gauge whether an AOI receives sustained attention or quick, concentrated bursts.

## Reading the Plot

- **Horizontal axis**: elapsed time in milliseconds; the axis title names the metric's window, and its step when the step differs.
- **Bands, curves, or rows**: one per AOI, in the AOI's color. Their height (or, in *Heatmap*, their color) is the metric value in each bin.
- **Vertical axis**: the metric and how participants were combined. In *Stream* the bands are stacked around a centered baseline, so the axis runs into negative values: read the thickness of a band, not its position.
- **Legend**: one entry per AOI; *No AOI* is the time outside every AOI unless **Hide No AOI data** is on.

For windowed calculations and frame math (sub-bin overlap vs. midpoint gating), see the [Metrics Library Overview](/docs/metrics), [Dwell Time & Fixation Durations](/docs/metrics/durations), and [Fixation Counts & Latency](/docs/metrics/counts-latency).

## Add an AOI Timeline

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Per AOI** > **AOI Timeline**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed in the occupancy plot.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by a participant selection.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric calculated inside each time bin.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the windowed `aoi-vector` contract. Standard metric templates include:
  - *Time on AOI* (`absoluteTime-aoi-windowed-500`): Total duration spent looking within the boundary per bin (see [Durations](/docs/metrics/durations)).
  - *Relative time on AOI* (`relativeTime-aoi-windowed-500`): Proportion of time spent in each AOI relative to the bin size (see [Durations](/docs/metrics/durations)).
  - *Fixation count per AOI* (`fixationCount-aoi-windowed-500`): Number of fixations registered in each AOI per bin (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit count per AOI* (`visitCount-aoi-windowed-500`): Number of visits registered in each AOI per bin (see [Counts & Latency](/docs/metrics/counts-latency)).
- **Edit metric library**: Opens the Metric Library modal where you can customize bin sizes (window size and step size) or define **custom windowed metrics**.

### Visualization
Configure the visual layout. The view decides which further controls the section shows; they are listed under the view that reveals them.
- **Select view**: How the time-binned data is arrayed.
  - *Stream* (default): A centered, flowing river-like visualization. Highlights the shifting volume of attention across AOIs without pinning data to a flat baseline, making broad temporal trends easily visible.
  - *Distribution*: A stacked area chart on a flat zero baseline, for reading the exact proportion or total occupancy of specific AOIs over time.
  - *Ridgeline*: Overlapping density curves per AOI, resembling a mountain range, for comparing peak attention times across AOIs independently.
    - **Ridge scale**: Vertical overlap (scale factor) between adjacent AOI curves, 1 to 10.
  - *Heatmap*: One row per AOI; color intensity encodes the metric value in each bin.
    - **Color scale**: Value range of the intensity gradient.
      - *Min*: Value mapped to the first gradient color.
      - *Max (0 = Auto)*: Value mapped to the last gradient color, or 0 to track the data maximum.
    - **Color scale picker**: Minimum, middle, and maximum colors of the gradient.
    - **Out of bounds**: Fills for bins outside the range above; each also appears as an end cap on the color bar legend. Bins are colored only, never printed, so there are no text-label toggles.
      - *Below min*: Fill for a bin below Min (default gray). A bin with no data at all is always transparent, regardless of this setting.
      - *Above max*: Fill for a bin above Max (default gray). Inert while Max is 0/Auto; its legend cap is hidden then too.
- **Hide No AOI data**: Drops the No AOI band (time outside every AOI), so only the named AOIs are shown.

### Time range
Filter the temporal range from which data is fetched.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are rendered.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the timeline plot as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection, time range, AOI selection and **Hide No AOI data** setting.

## Interactivity

- **Window details**: Hovering the plot shows a tooltip for the time window under the pointer: its **Window** span in ms, its **Bin** number, and the value of every AOI with data in that window.
- **Highlighting**: Clicking an AOI in the legend toggles a persistent highlight of that AOI.
- **Linked hovering**: The hovered moment is marked in the other plots of the same stimulus, see [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).

## Related

- [Scarf Plot](/docs/visualizations/scarf-plot/): the same AOI hits over time, one row per participant instead of pooled.
- [AOI Comparison](/docs/visualizations/aoi-comparison/): AOI metrics over the whole time range, without time bins.
- [Metric Timeline](/docs/visualizations/metric-timeline/): a windowed metric over time for each participant.
