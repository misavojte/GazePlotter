# Scanpath Similarity

Scanpath Similarity compares the gaze sequences of every pair of participants. Each scanpath is encoded as a string of letters, one per visited Area of Interest (AOI), and a string alignment algorithm scores how alike two strings are. The scores are drawn as a similarity matrix or as a **ScanGraph** network.

The ScanGraph view, including its similarity parameter *p*, the percentage-of-edges threshold, and the clique-based groups of similar participants, implements the scanpath comparison method of Doležalová and Popelka (2016); see the [Reference](#reference) below.

![Scanpath Similarity card in the workspace: Levenshtein similarity between the AOI sequences of every participant pair on the Yarbus Remember clothes stimulus.](/docs/images/scanpath-similarity.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, a participant selection |
| **Input** | The AOI sequence of each participant's fixations, encoded as a letter string |
| **Metric Library** | Any metric that produces a participant-by-participant similarity matrix, computed over the whole time range (sliding windows do not apply). See [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity) for the string encoding, Levenshtein distance, and Needleman-Wunsch alignment. |

## When to Use It

- **Scanning styles**: find groups of participants who looked at the stimulus in a similar order.
- **Structural clusters**: the ScanGraph view pulls similar participants together, and **Highlight clique** names the exact groups in which every pair meets the similarity threshold.
- **Algorithm choices**: compare *collapsed* Levenshtein (the order of visited AOIs) with standard Levenshtein (which keeps repeated fixations) to see how dwell affects who looks alike.

## Reading the Plot

- **Matrix** view (default): rows and columns are participants, and each cell holds the similarity of that pair, from 0 to 1. The diagonal compares each participant with themselves and reads 1.00. The color bar below names the metric.
- **ScanGraph** view: nodes are participants, and an edge joins every pair whose similarity reaches the threshold *p*. Participants who are all pairwise connected form a clique.

## Add a Scanpath Similarity Plot

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/).
2. In the rail on the left, click **Add Visualization**, then **Inter-participant** > **Scanpath Similarity**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. GazePlotter will compile the letter-coded scanpath sequences for participants based on this stimulus.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the analysis to a participant selection.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Select the sequence alignment algorithm from the Metric Library.
- **Select metric**: A dropdown of the library's similarity metrics:
  - *Levenshtein similarity*: Measures sequence similarity based on the minimum edit operations (insertions, deletions, substitutions) required to transform one sequence into another (see [Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity)).
  - *Levenshtein similarity (collapsed)*: Collapses consecutive fixations within the same AOI into a single letter before comparing, focusing on the order of visited AOIs rather than dwell duration.
  - *Needleman-Wunsch similarity*: A global sequence alignment method scored exactly as in the ScanGraph article, so thresholds are comparable with the original tool.
  - *Needleman-Wunsch similarity (collapsed)*: Collapses consecutive same-AOI fixations before global alignment.
- **Edit metric library**: Opens the Metric Library, where you can adjust algorithm parameters or save your own variants.

### Visualization
Configure the rendering layout and thresholding. The view decides which further controls appear; they are listed under the view that reveals them.
- **Select view**:
  - *Matrix*: Renders a square heatmap matrix where rows and columns represent participants, and cell color intensity corresponds to their similarity score.
    - **Color scale**: Value range of the similarity gradient.
      - *Min*: Value mapped to the first gradient color (default 0).
      - *Max (0 = Auto)*: Value mapped to the last gradient color, or 0 to track the data maximum.
    - **Color scale picker**: Start, middle, and end colors of the gradient.
    - **Out of bounds**: Fills for cells outside the range above; each also appears as an end cap on the color bar legend, and hovering the cap names the values it stands for. Each row is offered only while its end of the range is set.
      - *Below min*: Color (default gray) and a *Show text* toggle for cell values below Min. Shown while Min is above 0.
      - *Above max*: Color (default gray) and a *Show text* toggle for cell values above Max. Shown while Max is set (not 0/Auto).
  - *ScanGraph*: Renders a network graph (node-link diagram) where nodes represent participants, and lines (edges) connect participant pairs whose similarity score is above the threshold.
    - **Similarity threshold (0–1)**: The minimum similarity *p* required to draw an edge between two participant nodes (e.g. 0.50). Pairs below it are not connected.
    - **Edges (% of possible pairs)**: The same threshold seen from the other side: it always displays the share of participant pairs connected at the current *p*, so the two controls move together. Entering a percentage finds the *p* that draws at most that share of edges (ties round down, as in the ScanGraph article), and the field then shows the share actually achieved. The article's advised graph draws 5% of the possible edges.
    - **Min clique members**: The smallest clique the picker offers (default 2 = all cliques). Raising it hides the many small pairs a near-threshold graph produces, keeping the list focused on substantial groups.
    - **Highlight clique**: A clique is a group of participants that are **all pairwise similar** at the chosen threshold (the ScanGraph article's "groups of similar participants"). This dropdown lists every such group with at least the chosen number of members, largest first. Each option's secondary line reports the clique's internal agreement: the weakest pairwise similarity (`p ≥ …`, every member pair agrees at least this much) and the mean (`x̄`), followed by its members. Selecting one emphasizes its members and the edges **between** them while the rest of the graph recedes; edges leaving the clique stay plain, and members get first claim on label space. Nodes highlighted by clicking stay at full strength on top. On very dense graphs the clique list becomes unavailable and only *None* is offered; raise the threshold to bring it back.

### Time range
Limit the analysis to fixations that begin within this time range.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) get their own letter in the scanpath strings. Fixations outside every active AOI are encoded as `#` (no AOI), exactly as in the exported ScanGraph strings.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the similarity visualization as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection, time range and AOI selection.

## Reference

The ScanGraph view implements the scanpath comparison method introduced in:

> Doležalová, J., & Popelka, S. (2016). ScanGraph: A novel scanpath comparison method using visualisation of graph cliques. *Journal of Eye Movement Research*, 9(4). [https://doi.org/10.16910/jemr.9.4.5](https://doi.org/10.16910/jemr.9.4.5)

The authors' original web tool is available at [eyetracking.upol.cz/scangraph](http://eyetracking.upol.cz/scangraph); GazePlotter can [export scanpath strings](/docs/export/scangraph/) in the format it accepts.

## Related

- [Scarf Plot](/docs/visualizations/scarf-plot/): the AOI sequences being compared, drawn over time.
- [Scanpath](/docs/visualizations/scanpath/): one participant's fixations on the stimulus.
- [ScanGraph export](/docs/export/scangraph/): the scanpath strings in the format of the original ScanGraph tool.
