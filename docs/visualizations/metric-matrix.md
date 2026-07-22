# Metric Matrix

Metric Matrix in GazePlotter renders a participants × stimuli grid where every cell is colored by one scalar metric value computed for that single recording. It is the un-reduced, per-participant view of a scalar metric: instead of collapsing participants into a group average, the whole grid is laid out so you can scan every recording at once - to compare a metric across stimuli, and to spot at a glance which recordings are missing, failed, or otherwise untrustworthy before aggregating them elsewhere.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

To render a Metric Matrix plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `scalar` (computes a single numerical value per participant × stimulus pair).
- **Windowing**: `forbidden` (each cell is a whole-recording value, not a windowed sequence).
- **Cross-participant**: `per-participant` (each cell is one participant's own value; no cross-participant reduction is applied).
- **Single metric**: one metric instance drives the whole grid.

> **Metrics Documentation**: For details on metric shapes and projections, see the [Metrics Library Overview](/docs/metrics) and category sub-pages.

## Cell states

Every cell is classified independently of the chosen metric, so a capture failure reads the same whether the metric would compute to 0 or to nothing at all:

- **Finite value** (including a legitimate 0): colored by the gradient, value printed in the cell.
- **No recording**: the participant has no recording on that stimulus.
- **Recording present, no fixations**: the recording exists but contains zero fixations - a capture failure.
- **AOI not defined on this stimulus**: the metric references an AOI that this stimulus does not have (a benign configuration artifact, not a data problem).
- **Value not computable**: the recording is present with fixations, yet the metric yields no finite value.

Cells without a usable value use a neutral inactive fill - never the low end of the color scale, so a missing recording can never be misread as a low value. Hovering any cell shows a tooltip with the exact status, and for computed values also the number of fixations behind the value - the sample size a single number hides (a mean over 1 fixation vs. 500).

## Configuration via Pane

Clicking the Metric Matrix plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Participants
Choose which participants form the rows.
- **Participant selection**: A dropdown containing *All*, *Non-empty*, and saved participant selections. Rows are the selection's participants that have a recording on at least one shown stimulus, in the selection's order.
- **Edit participants & selections…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Stimuli
Choose which stimuli form the columns. Unlike single-stimulus plots, the Metric Matrix spans stimuli - there is no single stimulus picker.
- **Stimulus selection**: A dropdown containing *All* and saved stimulus selections; the columns are the picked selection's members in display order.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimuli and build stimulus selections.

### Metric
Configure the scalar metric that fills the cells.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the whole-recording `scalar` contract. The default is *Fixation duration* - an intensive (per-recording normalised) metric, so values stay comparable across stimuli of different lengths. Extensive metrics such as total counts or total durations work too, but read longer stimuli as uniformly higher from duration alone.
- **Edit metric library…**: Opens the Metric Library modal to change the metric's parameters, summary statistic (mean, median, max, min), or define custom scalar metrics.

### Visualisation
Configure the color mapping:
- **Scale range**: Explicit `[min, max]` bounds for the color scale, or leave the maximum at 0 for automatic scaling to the data maximum. A fixed range keeps several matrices comparable side by side.
- **Color scale picker**: Select the gradient stops (two or three colors) for the finite-value ramp; the default is a sequential blue ramp. The color bar legend beneath the figure is titled with the selected metric's full label and unit.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the matrix as a PNG or JPG.
- **Export Data**: To export the per-recording metric values as CSV, see [Metric Data Export](/docs/export/metric-data/).

## Interpretation

Use Metric Matrix to:
- **Screen data quality**: Missing recordings and capture failures stand out as neutral cells against the value gradient - check the grid before trusting group-level aggregates computed from the same data.
- **Compare recordings across stimuli**: Follow a participant's row to see how their metric changes from stimulus to stimulus, or a stimulus's column to spot outlier participants.
- **Judge the evidence behind a value**: Hover a cell to see how many fixations the metric collapsed - a suspiciously high or low value backed by a handful of fixations deserves less trust than one backed by hundreds.
