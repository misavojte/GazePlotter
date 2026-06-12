# Metric Correlation

Metric Correlation in GazePlotter provides statistical analysis of relationships between multiple eye-tracking metrics across participants. By calculating correlations between selected aggregate metrics (such as fixation durations, visit counts, or Recurrence Quantitative Analysis (RQA) measures), this visualization displays relationships as a color-coded correlation heatmap matrix or a grid of scatter plots (Scatter Plot Matrix / SPLOM).

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/basic/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/basic/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/basic/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/basic/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/basic/workspace/#removing-a-plot)

## Metric Contract

To render a Metric Correlation plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `scalar` (each selected metric must compute a single numerical value per participant across the selected duration).
- **Windowing**: `forbidden` (calculated across the selected time range as a single aggregate).
- **Selection**: `multi-select` (must select at least two metrics to compute correlations).

> **Metrics Documentation**: For details on how raw metric shapes translate to scalar projections (like matrix cell/aggregate or vector pick-aoi), see the [Metrics Library Overview](/docs/metrics) and category sub-pages.

## Configuration via Settings Pane

Clicking the Metric Correlation plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus for which metrics are aggregated.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and dimensions.

### Participant group
Filter the analysis to a specific participant group. The correlation is computed using the values of individual participants within this group.
- **Select group**: A dropdown containing *All participants* and custom participant groups.
- **Edit groups…**: Opens the Participant Groups modal to create or modify comparative groups.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

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
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, rename, or color-code AOIs.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the plot.
  - *File formats*: PNG (recommended, transparent background) or JPG (white background).
  - *Dimensions*: Customizable width (height maintained as square).
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable margins.
  - *Preview*: Live render of the output before saving.

## Interpretation

Use Metric Correlation to:
- **Identify dependent variables**: See if metrics are strongly correlated (e.g. if high RQA Determinism correlates with high average fixation duration, suggesting structured, longer processing).
- **Detect outliers**: SPLOM scatter plots highlight participants whose behavior deviates significantly from group trends.
- **Validate statistical assumptions**: Compare Pearson and Spearman correlations to determine if relationships are linear or non-linear.
