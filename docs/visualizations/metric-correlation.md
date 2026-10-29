# Metric Correlation

Metric Correlation shows how strongly eye-tracking metrics move together across participants. Each selected metric yields one value per participant, for example fixation duration, visit count, or a Recurrence Quantification Analysis (RQA) measure, and every pair of metrics gets a Spearman or Pearson correlation coefficient. The result is drawn as a color-coded correlation matrix or as a grid of scatter plots (Scatter Plot Matrix, SPLOM).

![Metric Correlation card in the workspace: Spearman correlation coefficients between the metrics in the Metric Library.](/docs/images/metric-correlation.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection; each participant is one sample |
| **Input** | Fixations on the stimulus, within the time range and AOI selection |
| **Metric Library** | Two or more `scalar` metrics, computed over the whole time range (no windows), one value per participant (see [Metrics](/docs/metrics)) |

## When to Use It

- **Discover behavioral trends**: For instance, a strong negative correlation between average fixation duration and visit count can reveal a scanning strategy of rapid, frequent visits vs. prolonged, deep inspections.
- **Relate visual metrics to complexity**: Assess if repetitive gaze behaviors (RQA Recurrence Rate) correlate with longer average fixation durations, suggesting visual confusion or detailed visual processing.
- **Identify outliers**: Scatter Plot Matrix (SPLOM) view plots individual participants as dots, helping identify anomalous participants who deviate from overall group trends.
- **Compare cohort stats**: Select Spearman vs. Pearson correlation coefficients to assess the impact of extreme values or non-linearities on behavior trends.

## Reading the Plot

- **Heatmap matrix**: rows and columns are the selected metrics. Each cell holds the correlation coefficient of the pair, printed in the cell and colored from blue (-1) through white (0) to red (+1). The diagonal is each metric against itself.
- **Scatterplot matrix (SPLOM)**: the diagonal shows each metric's unit (or its label when it has none), the upper triangle prints the coefficient, and the lower triangle is a scatter of the pair with one dot per participant.
- **Legend title**: the method and the number of participants, for example *Spearman correlation coefficient · N = 13*. When some participants lack a value for a metric, the smallest number of complete pairs behind any cell is added as *min pairwise n*.
- **Missing coefficients**: a gray cell with *—* means no coefficient exists for the pair: too few participants have values for both metrics, or one metric has the same value for everyone.

## Add a Metric Correlation

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Per participant** > **Metric Correlation**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first, then the **Metrics**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus for which metrics are aggregated.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the analysis to a participant selection. The correlation uses the values of the individual participants in it.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metrics
Select which metrics to correlate. Each must compute a single value per participant over the selected time range (output shape `scalar`, windowing `forbidden`); for how raw metric shapes become scalar projections (like matrix cell/aggregate or vector pick-aoi), see the [Metrics Library Overview](/docs/metrics) and its category pages.
- **Select metrics**: A multi-select dropdown to choose two or more metric instances from the library. The default selection holds these standard aggregate metrics:
  - *Absolute dwell time* (`absoluteTime-any`): Total viewing time (see [Durations](/docs/metrics/durations)).
  - *Visit count* (`visitCount-any`): Total visits (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit duration* (`visitDuration-any`): Mean visit length (see [Durations](/docs/metrics/durations)).
  - *Fixation count* (`fixationCount-any`): Total fixations (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Fixation duration* (`fixationDuration-any`): Mean fixation length (see [Durations](/docs/metrics/durations)).
  - *Time to first fixation* (`timeToFirstFixation-any`): Initial latency (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *First fixation duration* (`firstFixationDuration-any`): Latency of first fixation (see [Durations](/docs/metrics/durations)).
  - *Recurrence rate* (`rqaRec`): Recurrence Rate from recurrence analysis (see [RQA Metrics](/docs/metrics/rqa)).
  - *Determinism* (`rqaDet`): Proportion of recurrence points forming diagonal lines (see [RQA Metrics](/docs/metrics/rqa)).
  - *Laminarity* (`rqaLam`): Proportion of recurrence points forming vertical lines (see [RQA Metrics](/docs/metrics/rqa)).
- **Edit metric library**: Opens the Metric Library modal where you can customize parameters or define custom aggregate metrics.

### Visualization
Configure the visual display format.
- **Select view**:
  - *Heatmap matrix*: Renders a square correlation matrix grid where rows and columns represent the selected metrics. Cell color intensity represents the correlation coefficient (ranging from -1.0 to +1.0). This is the default.
  - *Scatterplot matrix (SPLOM)*: Renders the coefficients above the diagonal and a pairwise scatter plot of participant values below it, highlighting outliers and individual distributions.

### Correlation method
Select the statistical algorithm used to calculate correlation coefficients:
- **Spearman**: Measures monotonic relationships using ranks (ρ). Resilient to non-linear associations and outliers. This is the default.
- **Pearson**: Measures the linear relationship between metrics (r). Best for normally distributed, continuous data; sensitive to outliers.

### Time range
Filter the temporal range.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are active for the metric calculations. If AOIs are selected, only fixations landing within those boundaries are included in the scalar metric calculations.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the correlation plot as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection, time range and AOI selection.

## Interactivity

- **Linked hovering**: In the *Scatterplot matrix (SPLOM)* view, a participant hovered in another plot is marked as a ring on their dot, see [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).

## Related

- [Metric Matrix](/docs/visualizations/metric-matrix/): the per-participant values of one metric across stimuli, before they are correlated.
- [Metric Timeline](/docs/visualizations/metric-timeline/): one metric over moving time windows.
- [Metric Data export](/docs/export/metric-data/): the values behind the coefficients, for your own statistics.
