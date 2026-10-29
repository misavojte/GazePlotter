# Transition Matrix

A transition matrix shows how often gaze moves from one Area of Interest (AOI) to another. Each row is the AOI gaze leaves, each column the AOI it arrives at, and each cell is shaded by the selected transition metric, by default the number of fixation-to-fixation transitions. Read it to see which AOIs lead to which, which pairs are never connected, and which AOIs act as hubs.

![Transition Matrix card in the workspace: counts of gaze transitions between AOIs on the Yarbus Remember clothes stimulus.](/docs/images/transition-matrix.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection |
| **Input** | Fixations with their AOI hits, within the time range |
| **Metric Library** | One metric with the `aoi-pair-matrix` output shape (a value for each FROM and TO AOI pair), calculated across the selected time range as a single aggregate (windowing `forbidden`). Default: *Transitions*, fixation-based |

## When to Use It

- **Identify scanpath patterns**: Discover common gaze movement sequences between specific AOIs.
- **Compare transition frequencies**: See which AOI pairs attract the most visual transitions.
- **Analyze attention flow**: Understand visual search hierarchies and navigation order.
- **Detect visual hierarchies**: Identify which AOIs serve as hubs (attracting and distributing attention).

## Reading the Plot

- **Rows** (**From AOI**): where gaze typically goes FROM each AOI.
- **Columns** (**To AOI**): where gaze typically comes TO each AOI.
- **Diagonal values**: transitions within the same AOI (re-fixations, dwell consistency).
- **Empty cells**: transitions that rarely or never occur.
- **Cells**: shaded by the metric value and labeled with it. The color bar under the matrix names the metric and its range; values outside the range take the **Out of bounds** colors.

## Add a Transition Matrix

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Inter-AOI** > **Transition Matrix**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which form the rows and columns of the matrix.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by a participant selection.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative transition metric displayed in the matrix cells. For transitions, Markov probability models (`P^k`), and visit collapsing, see [AOI Transitions & Markov Metrics](/docs/metrics/transitions).
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `aoi-pair-matrix` shape contract. Standard metrics include:
  - *Transitions*, fixation-based (`transitionCount-fix`): Raw number of transitions between AOI pairs based on individual fixations (see [Transitions](/docs/metrics/transitions)).
  - *Transitions*, visit-based (`transitionCount-visit`): Raw transitions based on distinct visits (consecutive fixations) (see [Transitions](/docs/metrics/transitions)).
  - *Transition probability* (`transitionProbability-fix`): Conditional probability of transitioning TO an AOI given you are coming FROM a specific AOI (see [Transitions](/docs/metrics/transitions)).
  - *Mean transition dwell time*, fixation-based (`transitionDwellMean-fix`): Average fixation duration in the "FROM" AOI before a transition (see [Transitions](/docs/metrics/transitions)).
  - *Mean transition dwell time*, visit-based (`transitionDwellMean-visit`): Average total duration of consecutive fixations in the "FROM" AOI before transitioning (see [Transitions](/docs/metrics/transitions)).
- **Edit metric library**: Opens the Metric Library modal where you can customize transition calculation parameters or define **custom transition/matrix metrics**.

### Visualization
Configure cell scaling, colors, and outlier rendering.
- **Color scale**: Customizes cell shading mapping.
  - *Min*: Set value mapped to the minimum color intensity.
  - *Max (0 = Auto)*: Set value mapped to the maximum color intensity or leave at 0 for automatic maximum scaling.
- **Color scale picker**: Interactive color picker to select the start, middle, and end colors for the matrix gradient.
- **Out of bounds**: Custom color settings for values that fall outside the range set above. Each color also appears as an end cap on the color bar legend, and hovering the cap names the values it stands for. Each row is offered only while its end of the range is set.
  - *Below min*: Choose color (default is gray) and toggle *Show text* labels for cell values below minimum. Shown while Min is above 0.
  - *Above max*: Choose color (default is gray) and toggle *Show text* labels for cell values above maximum. Shown while Max is set (not 0/Auto).
- **Hide No AOI data**: Drops the No AOI row and column, so only transitions between named AOIs are shown.

### Time range
Filter the temporal range from which transitions are calculated.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are rendered as rows and columns in the matrix.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the transition matrix as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection, time range and AOI selection.

## Interactivity

- **Cell details**: Hovering a cell shows a tooltip with its **From** AOI, **To** AOI, and **Value**. A value that cannot be computed reads *Undefined, not zero*.
- **Shared color scale**: Transition matrices with the same metric, color scale, and card size share one color range while they keep the default range, so their colors compare directly.

## Related

- [Scarf Plot](/docs/visualizations/scarf-plot/): the AOI sequence behind the transitions, one row per participant.
- [AOI Comparison](/docs/visualizations/aoi-comparison/): metrics per AOI rather than per AOI pair.
- [Scanpath Similarity](/docs/visualizations/scanpath-similarity/): how alike whole AOI sequences of participant pairs are.
- [AOI Transitions & Markov Metrics](/docs/metrics/transitions): how the transition metrics are calculated.
