# Scanpath Similarity

Scanpath similarity metrics quantify the spatial and temporal similarity between the gaze trajectories of different participants. In GazePlotter, this comparison is computed pairwise, representing the alignment of scanpaths across the entire group.

---

## Output

All scanpath similarity metrics produce a participant-by-participant grid: one similarity score for every pair of participants in the selected group. This output is what the [Scanpath Similarity](/docs/visualizations/scanpath-similarity) visualization consumes; because the result is inherently a property of the whole group, it cannot be reshaped for other plots.

### Invariants
- **Measurement class**: Group-level. The result is inherently a property of a *pair* of participants, where both the row and column axes are the participants themselves. There is no per-participant value to combine across the group; the matrix is already the across-participant result, so no further aggregation applies.
- **Windowing**: Not available: the comparison always covers the whole selected time range. Cropping by a Time of Interest (the Start/End bounds in the Pane) is supported; a fixation is encoded into the scanpath string only if it begins within the range.

---

## Scanpath String Encoding

To compare scanpaths, GazePlotter converts each participant's fixation sequence into an AOI-letter string:
- Each active AOI is mapped to a unique letter (the first AOI becomes 'A', the second 'B', and so on).
- Fixations that do not land within any active AOI are encoded using a special hash character (`#`).

---

## Metrics

### Participant Pair Similarity
Computes the similarity score for every pair of participant scanpaths. The resulting matrix is symmetric (similarity from participant i to j equals j to i) and has a diagonal of 1.0 (every participant is identical to themselves). A pair where **both** scanpaths are empty (no fixations in the analyzed range) carries no value: the matrix renders those cells as missing, and such pairs never form edges or cliques in the ScanGraph view. A pair where only one scanpath is empty scores 0, as the formulas define.

#### Parameters

1. **Similarity Method**:
   - **Levenshtein**: Calculates the minimum edit distance (insertions, deletions, and substitutions) required to transform one scanpath string into the other. The score is normalized by the maximum length of the two scanpaths:
     
     `Similarity = 1 - (Edit Distance / max(Length_1, Length_2))`
     
   - **Needleman-Wunsch**: A dynamic programming algorithm for global sequence alignment. It scores alignments with the ScanGraph weights (Match = +1, Mismatch = -1, Gap = 0) and divides the alignment score by the maximum length of the two scanpaths:
     
     `Similarity = Alignment Score / max(Length_1, Length_2)`
     
     This is the similarity parameter *p* of the ScanGraph method (Doležalová & Popelka, 2016; see [Reference](#reference)), so thresholds chosen here are directly comparable with results from the standalone ScanGraph tool.

2. **Collapsed Scanpaths**:
   - **Off** (default): Consecutive fixations inside the same AOI are preserved. A participant who fixates AOI A three times before moving to B is encoded as "AAAB".
   - **On**: Consecutive identical AOI entries are collapsed into a single letter ("AAAB" → "AB"). This removes duration-based variance, isolating the analysis to focus purely on the structural order of visited regions.

---

## Visualizing the Similarity Matrix

The resulting similarity scores can be explored in two ways under the [Scanpath Similarity](/docs/visualizations/scanpath-similarity) visualization:
1. **Heatmap Matrix**: Displays the full participant-by-participant grid, colored by similarity strength, to identify clusters of participants with similar viewing strategies.
2. **ScanGraph Network**: Represents participants as nodes in a graph. An edge is drawn between two participants only if their similarity score meets a user-defined threshold, helping visualize communities of shared attention.

## Reference

The Needleman-Wunsch scoring, the similarity parameter *p*, and the ScanGraph network are based on:

> Doležalová, J., & Popelka, S. (2016). ScanGraph: A novel scanpath comparison method using visualisation of graph cliques. *Journal of Eye Movement Research*, 9(4). [https://doi.org/10.16910/jemr.9.4.5](https://doi.org/10.16910/jemr.9.4.5)
