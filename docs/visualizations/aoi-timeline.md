# AOI Timeline

AOI Timeline in GazePlotter provides a continuous visualization of how visual attention is distributed across Areas of Interest (AOIs) over time. By segmenting the timeline into discrete bins, this plot reveals the dynamic flow and density of participants' gaze, making it easier to identify peak attention periods and shifts between AOIs.

<!-- ![](/docs/images/eyetracking-aoi-stream-gazeplotter.jpg) -->

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

To render a AOI Timeline plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `aoi-vector` (computes a value or distribution for each Area of Interest individually).
- **Windowing**: `required` (must specify a window/bin size and step size to calculate the time course of attention).

> **Metrics & Windowing Documentation**: For details on windowed calculations and Svelte-side frame math (like sub-bin overlap vs. midpoint-gating), see the [Metrics Library Overview](/docs/metrics), [Dwell Time & Fixation Durations](/docs/metrics/durations), and [Fixation Counts & Latency](/docs/metrics/counts-latency).

## Configuration via Pane

Clicking the AOI Timeline plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed in the occupancy plot.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by a participant selection.
- **Participant selection**: A dropdown containing *All*, *Non-empty*, and saved participant selections.
- **Edit participants & selections…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric calculated inside each time bin.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the windowed `aoi-vector` contract. Standard metric templates include:
  - *Time on AOI* (`absoluteTime-aoi-windowed-500`): Total duration spent looking within the boundary per bin (see [Durations](/docs/metrics/durations)).
  - *Relative time on AOI* (`relativeTime-aoi-windowed-500`): Proportion of time spent in each AOI relative to the bin size (see [Durations](/docs/metrics/durations)).
  - *Fixation count per AOI* (`fixationCount-aoi-windowed-500`): Number of fixations registered in each AOI per bin (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit count per AOI* (`visitCount-aoi-windowed-500`): Number of visits registered in each AOI per bin (see [Counts & Latency](/docs/metrics/counts-latency)).
- **Edit metric library…**: Opens the Metric Library modal where you can customize bin sizes (window size and step size) or define **custom windowed metrics**.

### Visualisation
Configure the visual layout. The view decides which further controls the section shows; they are listed under the view that reveals them.
- **Select view**: How the time-binned data is arrayed.
  - *Stream*: A centered, flowing river-like visualization. Highlights the shifting volume of attention across AOIs without pinning data to a flat baseline, making broad temporal trends easily visible.
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
- **Hide data**: Check *No AOI data* to hide participants who have zero registered fixations/events across all AOIs.

### Time range [ms]
Filter the temporal range from which data is fetched.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are rendered.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections…**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the timeline plot as a PNG or JPG.
- **Export Data**: To export the windowed per-AOI values per participant as CSV, see [Metric Data Export](/docs/export/metric-data/).

## Interpretation

Use AOI Timeline to:
- **Analyze attention shifts**: Observe when participants collectively move their gaze from one AOI to another.
- **Identify peak engagement**: Pinpoint the exact moments when specific features receive maximum visual attention.
- **Compare group synchrony**: Assess whether different participant groups exhibit distinct or synchronized gaze behaviors over time.
- **Evaluate temporal distribution**: Gauge whether an AOI receives sustained attention or quick, concentrated bursts.
