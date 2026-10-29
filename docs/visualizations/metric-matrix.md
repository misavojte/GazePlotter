# Metric Matrix

A Metric Matrix is a participants × stimuli grid where every cell is colored by one scalar eye-tracking metric computed for that single recording. It is the un-reduced, per-participant view of a scalar metric: instead of collapsing participants into a group average, the whole grid is laid out so you can scan every recording at once, to compare a metric across stimuli and to spot which recordings are missing, failed, or otherwise untrustworthy before aggregating them elsewhere.

![Metric Matrix card in the workspace: mean fixation duration per participant and stimulus.](/docs/images/metric-matrix.webp)

| | |
| --- | --- |
| **Scope** | A stimulus selection (columns) and a participant selection (rows) |
| **Input** | Each participant's fixations on each stimulus, over the whole recording |
| **Metric Library** | One `scalar` metric, not windowed, computed per participant: each cell is one participant's own value with no cross-participant reduction (see [Metrics](/docs/metrics)) |

## When to Use It

- **Screen data quality**: Missing recordings and capture failures stand out as neutral cells against the value gradient. Check the grid before trusting group-level aggregates computed from the same data.
- **Compare recordings across stimuli**: Follow a participant's row to see how their metric changes from stimulus to stimulus, or a stimulus's column to spot outlier participants.
- **Judge the evidence behind a value**: Hover a cell to see how many fixations the metric collapsed. A suspiciously high or low value backed by a handful of fixations deserves less trust than one backed by hundreds.

## Reading the Plot

- **Rows**: one per participant, in participant order.
- **Columns**: one per stimulus of the selection, in display order.
- **Cells**: colored by the metric value, with the value printed in the cell. The color bar beneath the figure is titled with the metric's full label and unit.
- **Neutral cells**: no usable value, see [Cell states](#cell-states).

### Cell states

Every cell is classified independently of the chosen metric, so a capture failure reads the same whether the metric would compute to 0 or to nothing at all:

- **Finite value** (including a legitimate 0): colored by the gradient, value printed in the cell.
- **No recording**: the participant has no recording on that stimulus.
- **Recording present, no fixations**: the recording exists but contains zero fixations, a capture failure.
- **AOI not defined on this stimulus**: the metric references an AOI that this stimulus does not have (a benign configuration artifact, not a data problem).
- **Value not computable**: the recording is present with fixations, yet the metric yields no finite value.

Cells without a usable value use a neutral inactive fill, never the low end of the color scale, so a missing recording can never be misread as a low value. Hovering any cell shows a tooltip with the exact status, and for computed values also the number of fixations behind the value: the sample size a single number hides (a mean over 1 fixation vs. 500).

## Add a Metric Matrix

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Per participant** > **Metric Matrix**. When another plot is selected, the new one opens on its participants.
3. The pane on the right opens with the plot's settings. Pick the **Participants** and **Stimuli**, then the **Metric**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Participants
Choose which participants form the rows.
- **Participant selection**: *All* or a saved participant selection, one row per participant in participant order. **Hide participants without data** leaves out those with no recording on any shown stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Stimuli
Choose which stimuli form the columns. Unlike single-stimulus plots, the Metric Matrix spans stimuli, so there is no single stimulus picker.
- **Stimulus selection**: A dropdown containing *All* and saved stimulus selections; the columns are the picked selection's members in display order.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimuli and build stimulus selections.

### Metric
Configure the scalar metric that fills the cells. The metric must compute a single whole-recording value (output shape `scalar`, windowing `forbidden`); one metric instance drives the whole grid.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the whole-recording `scalar` contract. The default is *Fixation duration*, an intensive (per-recording normalised) metric, so values stay comparable across stimuli of different lengths. Extensive metrics such as total counts or total durations work too, but read longer stimuli as uniformly higher from duration alone.
- **Edit metric library**: Opens the Metric Library modal to change the metric's parameters, summary statistic (mean, median, max, min), or define custom scalar metrics.

### Visualization
Configure the color mapping:
- **Color scale**: Explicit bounds for the color mapping. A fixed range keeps several matrices comparable side by side.
  - *Min*: Set value mapped to the minimum color intensity.
  - *Max (0 = Auto)*: Set value mapped to the maximum color intensity, or leave at 0 for automatic scaling to the data maximum.
- **Color scale picker**: Select the gradient stops (two or three colors) for the finite-value ramp; the default is a sequential blue ramp. The color bar legend beneath the figure is titled with the selected metric's full label and unit.
- **Out of bounds**: Custom color settings for values that fall outside the range set above. Each color also appears as an end cap on the color bar legend.
  - *Below min*: Choose color (default is gray) and toggle *Show text* labels for cell values below minimum.
  - *Above max*: Choose color (default is gray) and toggle *Show text* labels for cell values above maximum. Inert while Max is left at 0/Auto, and its legend cap is hidden then too.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the matrix as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics and participant selection, across all stimuli.

## Interactivity

- **Cell details**: Hovering a cell shows its status and, for computed values, the number of fixations behind the value (see [Cell states](#cell-states)).
- **Linked hovering**: The hovered participant is marked in the other plots of the workspace, and a participant hovered elsewhere is marked here, see [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).

## Related

- [Metric Correlation](/docs/visualizations/metric-correlation/): how several metrics relate across participants on one stimulus.
- [Metric Timeline](/docs/visualizations/metric-timeline/): one metric over moving time windows within a stimulus.
- [Metric Data export](/docs/export/metric-data/): the values behind the cells, for your own statistics.
