# Scanpath Similarity

Scanpath Similarity in GazePlotter enables pairwise comparison of participant gaze trajectories using string alignment algorithms. By encoding scanpaths as letter sequences based on visited Areas of Interest (AOIs), this visualization measures how similar participants' search patterns are, rendering results either as a correlation heatmap matrix or a network graph.

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/setup/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/setup/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/setup/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/setup/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/setup/workspace/#removing-a-plot)

## Metric Contract

To render a Scanpath Similarity visualization, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `participant-pair-matrix` (computes a similarity score between every pair of participants in the selected group).
- **Windowing**: `forbidden` (calculated across the selected time range as a single aggregate).

> **Scanpath Similarity Documentation**: For details on scanpath string encoding, Levenshtein edit distance, and Needleman-Wunsch global alignment parameters, see the [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity) documentation.

## Configuration via Settings Pane

Clicking the Scanpath Similarity plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. GazePlotter will compile the letter-coded scanpath sequences for participants based on this stimulus.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and dimensions.

### Participant group
Filter the analysis to a specific participant group.
- **Select group**: A dropdown containing *All participants* and custom participant groups.
- **Edit groups…**: Opens the Participant Groups modal to create or modify comparative groups.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

### Metric
Select the sequence alignment algorithm from the Metric Library.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `participant-pair-matrix` contract:
  - *Scanpath Similarity (Levenshtein)* (`participantPairSimilarity-lev`): Measures sequence similarity based on the minimum edit operations (insertions, deletions, substitutions) required to transform one sequence into another (see [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity)).
  - *Scanpath Similarity (Levenshtein, collapsed)* (`participantPairSimilarity-lev-collapsed`): Collapses consecutive fixations within the same AOI into a single character before calculating Levenshtein distance, focusing on sequence order rather than duration (see [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity)).
  - *Scanpath Similarity (Needleman-Wunsch)* (`participantPairSimilarity-nw`): A global sequence alignment method using gap penalties to align sequences optimally (see [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity)).
- **Edit metric library…**: Opens the Metric Library modal where you can customize algorithm parameters or write custom distance recipes.

### Visualisation
Configure the rendering layout and thresholding options:
- **Select view**:
  - *Matrix*: Renders a square heatmap matrix where rows and columns represent participants, and cell color intensity corresponds to their similarity score.
  - *ScanGraph*: Renders a network graph (node-link diagram) where nodes represent participants, and lines (edges) connect participant pairs whose similarity score is above the defined threshold.
- **Similarity threshold (0–1)** (visible only in *ScanGraph* view): Set the minimum similarity score required to draw an edge between two participant nodes (e.g. 0.50). Pairs with similarity below this threshold will not be connected.
- **Color scale** (visible only in *Matrix* view):
  - *Min*: Set value mapped to the minimum similarity color (default 0.0).
  - *Max (0 = Auto)*: Set value mapped to the maximum similarity color (default 1.0).
- **Color Scale Picker** (visible only in *Matrix* view): Choose the start, middle, and end colors for the similarity heatmap gradient.

### Time range [ms]
Filter the temporal range from which fixations are serialized.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are included in the letter-coding sequence. Fixations outside active AOIs are excluded from scanpath serialization.
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, rename, or color-code AOIs.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the similarity visualization.
  - *File formats*: PNG (transparent background) or JPG (white background).
  - *Dimensions*: Customizable width (height maintained as square).
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable margins.
  - *Preview*: Live render of the output before saving.
- **Export Data**: To export the similarity matrix as a CSV file for statistical analysis (e.g. cluster analysis), see the [Scanpath Similarity Export](/docs/export/scanpath-similarity/) documentation.

## Interpretation

Use Scanpath Similarity to:
- **Discover scanning styles**: Matrix view heat spots reveal groups of participants who looked at the stimulus in a similar sequence.
- **Analyze structural clusters**: ScanGraph view visually groups similar participants together. Interconnected clusters represent common visual inspection strategies.
- **Compare algorithmic constraints**: Toggle between *collapsed* Levenshtein (emphasizes spatial path sequence) and standard Levenshtein (retains fixation duration differences) to see how temporal variance affects participant parity.
