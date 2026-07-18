# Metric Correlation

Metric Correlation in GazePlotter provides statistical analysis of relationships between multiple eye-tracking metrics across participants. By calculating correlations between selected aggregate metrics (such as fixation durations, visit counts, or Recurrence Quantification Analysis (RQA) measures), this visualization displays relationships as a color-coded correlation heatmap matrix or a grid of scatter plots (Scatter Plot Matrix / SPLOM).

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

To render a Metric Correlation plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `scalar` (each selected metric must compute a single numerical value per participant across the selected duration).
- **Windowing**: `forbidden` (calculated across the selected time range as a single aggregate).
- **Selection**: `multi-select` (must select at least two metrics to compute correlations).

> **Metrics Documentation**: For details on how raw metric shapes translate to scalar projections (like matrix cell/aggregate or vector pick-aoi), see the [Metrics Library Overview](/docs/metrics) and category sub-pages.

## Configuration via Pane

Clicking the Metric Correlation plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus for which metrics are aggregated.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the analysis to a specific participant group. The correlation is computed using the values of individual participants within this group.
- **Participant selection**: A dropdown containing *All*, *Non-empty*, and saved participant selections.
- **Edit participants & selections…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metrics
Select which metrics to correlate.
- **Select metrics**: A multi-select dropdown to choose two or more metric instances from the library. Standard aggregate metrics include:
  - *Time on stimulus* (`absoluteTime-any`): Total viewing time (see [Durations](/docs/metrics/durations)).
  - *Visit count* (`visitCount-any`): Total visits (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Visit duration* (`visitDuration-any`): Mean visit length (see [Durations](/docs/metrics/durations)).
  - *Fixation count* (`fixationCount-any`): Total fixations (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *Average fixation duration* (`fixationDuration-any`): Mean fixation length (see [Durations](/docs/metrics/durations)).
  - *Time to first fixation* (`timeToFirstFixation-any`): Initial latency (see [Counts & Latency](/docs/metrics/counts-latency)).
  - *First fixation duration* (`firstFixationDuration-any`): Latency of first fixation (see [Durations](/docs/metrics/durations)).
  - *RQA Recurrence* (`rqaRec`): Recurrence Rate from recurrence analysis (see [RQA Metrics](/docs/metrics/rqa)).
  - *RQA Determinism* (`rqaDet`): Proportion of recurrence points forming diagonal lines (see [RQA Metrics](/docs/metrics/rqa)).
  - *RQA Laminarity* (`rqaLam`): Proportion of recurrence points forming vertical lines (see [RQA Metrics](/docs/metrics/rqa)).
- **Edit metric library…**: Opens the Metric Library modal where you can customize parameters or define custom aggregate metrics.

### Visualisation
Configure the visual display format.
- **Select view**:
  - *Heatmap matrix*: Renders a square correlation matrix grid where rows and columns represent the selected metrics. Cell color intensity represents the correlation coefficient (ranging from -1.0 to +1.0).
  - *Scatterplot matrix (SPLOM)*: Renders a Scatter Plot Matrix showing pairwise scatter plots with linear regression lines for each pair of metrics, highlighting outliers and individual distributions.

### Correlation method
Select the statistical algorithm used to calculate correlation coefficients:
- **Pearson**: Measures the linear relationship between metrics. Best for normally distributed, continuous data.
- **Spearman**: Measures monotonic relationships using ranks. Resilient to non-linear associations and outliers.

### Time range [ms]
Filter the temporal range.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are active for the metric calculations. If AOIs are selected, only fixations landing within those boundaries are included in the scalar metric calculations.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections…**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the correlation plot as a PNG or JPG.
- **Export Data**: To export raw metric correlation values as CSV, see [Metric Data Export](/docs/export/metric-data/).

## Interpretation

Use Metric Correlation to:
- **Discover behavioral trends**: For instance, a strong negative correlation between average fixation duration and visit count can reveal a scanning strategy of rapid, frequent visits vs. prolonged, deep inspections.
- **Relate visual metrics to complexity**: Assess if repetitive gaze behaviors (RQA Recurrence Rate) correlate with longer average fixation durations, suggesting visual confusion or detailed visual processing.
- **Identify outliers**: Scatter Plot Matrix (SPLOM) view plots individual participants as dots, helping identify anomalous participants who deviate from overall group trends.
- **Compare cohort stats**: Select Spearman vs. Pearson correlation coefficients to assess the impact of extreme values or non-linearities on behavior trends.