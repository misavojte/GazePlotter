# Scanpath Similarity

Scanpath Similarity in GazePlotter enables pairwise comparison of participant gaze trajectories using string alignment algorithms. By encoding scanpaths as letter sequences based on visited Areas of Interest (AOIs), this visualization measures how similar participants' search patterns are, rendering results either as a similarity matrix or as a **ScanGraph** network.

The ScanGraph view, including its similarity parameter *p*, the percentage-of-edges threshold, and the clique-based groups of similar participants, implements the scanpath comparison method of Doležalová and Popelka (2016); see the [Reference](#reference) below.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## What the plot needs

The plot draws its numbers from the workspace's [Metric Library](/docs/metrics). It accepts any metric that produces a participant-by-participant similarity matrix: one score for every pair of participants in the selected group, computed over the whole selected time range (sliding windows do not apply to this comparison).

> **Scanpath Similarity Documentation**: For details on scanpath string encoding, Levenshtein edit distance, and Needleman-Wunsch global alignment, see the [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity) documentation.

## Configuration via Pane

Clicking the Scanpath Similarity plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. GazePlotter will compile the letter-coded scanpath sequences for participants based on this stimulus.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the analysis to a specific participant group.
- **Participant selection**: A dropdown containing *All*, *Non-empty*, and saved participant selections.
- **Edit participants & selections…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Select the sequence alignment algorithm from the Metric Library.
- **Select metric**: A dropdown of the library's similarity metrics:
  - *Levenshtein similarity*: Measures sequence similarity based on the minimum edit operations (insertions, deletions, substitutions) required to transform one sequence into another (see [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity)).
  - *Levenshtein similarity (collapsed)*: Collapses consecutive fixations within the same AOI into a single letter before comparing, focusing on the order of visited AOIs rather than dwell duration.
  - *Needleman-Wunsch similarity*: A global sequence alignment method scored exactly as in the ScanGraph article, so thresholds are comparable with the original tool.
  - *Needleman-Wunsch similarity (collapsed)*: Collapses consecutive same-AOI fixations before global alignment.
- **Edit metric library…**: Opens the Metric Library, where you can adjust algorithm parameters or save your own variants.

### Visualisation
Configure the rendering layout and thresholding options:
- **Select view**:
  - *Matrix*: Renders a square heatmap matrix where rows and columns represent participants, and cell color intensity corresponds to their similarity score.
  - *ScanGraph*: Renders a network graph (node-link diagram) where nodes represent participants, and lines (edges) connect participant pairs whose similarity score is above the defined threshold.
- **Similarity threshold (0–1)** (visible only in *ScanGraph* view): The minimum similarity *p* required to draw an edge between two participant nodes (e.g. 0.50). Pairs with similarity below this threshold will not be connected.
- **Edges (% of possible pairs)** (visible only in *ScanGraph* view): The same threshold seen from the other side: it always displays the share of participant pairs connected at the current *p*, so the two controls move together. Entering a percentage finds the *p* that draws at most that share of edges (ties round down, as in the ScanGraph article), and the field then shows the share actually achieved. The article's advised graph draws 5% of the possible edges.
- **Min clique members** (visible only in *ScanGraph* view): The smallest clique the picker offers (default 2 = all cliques). Raising it hides the many small pairs a near-threshold graph produces, keeping the list focused on substantial groups.
- **Highlight clique** (visible only in *ScanGraph* view): A clique is a group of participants that are **all pairwise similar** at the chosen threshold (the ScanGraph article's "groups of similar participants"). This dropdown lists every such group with at least the chosen number of members, largest first. Each option's secondary line reports the clique's internal agreement: the weakest pairwise similarity (`p ≥ …`, every member pair agrees at least this much) and the mean (`x̄`), followed by its members. Selecting one emphasizes its members and the edges **between** them while the rest of the graph recedes; edges leaving the clique stay plain, and members get first claim on label space. Nodes highlighted by clicking stay at full strength on top. On very dense graphs the clique list becomes unavailable and only *None* is offered; raise the threshold to bring it back.
- **Color scale** (visible only in *Matrix* view):
  - *Min*: Set value mapped to the minimum similarity color (default 0.0).
  - *Max (0 = Auto)*: Set value mapped to the maximum similarity color (default 1.0).
- **Color Scale Picker** (visible only in *Matrix* view): Choose the start, middle, and end colors for the similarity heatmap gradient.

### Time range [ms]
Limit the analysis to fixations that begin within this time range.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) get their own letter in the scanpath strings. Fixations outside every active AOI are encoded as `#` (no AOI), exactly as in the exported ScanGraph strings.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections…**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the similarity visualization as a PNG or JPG.
- **Export Data**: To export the similarity values as CSV, see [Metric Data Export](/docs/export/metric-data/).

## Interpretation

Use Scanpath Similarity to:
- **Discover scanning styles**: Matrix view heat spots reveal groups of participants who looked at the stimulus in a similar sequence.
- **Analyze structural clusters**: ScanGraph view visually groups similar participants together, and **Highlight clique** names the exact groups, where every pair of members meets the similarity threshold.
- **Compare algorithm choices**: Toggle between *collapsed* Levenshtein (emphasizes the order of visited AOIs) and standard Levenshtein (retains fixation duration differences) to see how dwell time affects which participants look alike.

## Reference

The ScanGraph view implements the scanpath comparison method introduced in:

> Doležalová, J., & Popelka, S. (2016). ScanGraph: A novel scanpath comparison method using visualisation of graph cliques. *Journal of Eye Movement Research*, 9(4). [https://doi.org/10.16910/jemr.9.4.5](https://doi.org/10.16910/jemr.9.4.5)

The authors' original web tool is available at [eyetracking.upol.cz/scangraph](http://eyetracking.upol.cz/scangraph); GazePlotter can [export scanpath strings](/docs/export/scangraph/) in the format it accepts.