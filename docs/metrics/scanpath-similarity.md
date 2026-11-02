# Scanpath Similarity

Scanpath similarity metrics score how alike every pair of participants looked. Levenshtein and Needleman-Wunsch compare the order of visited AOIs. [Transition similarity](#transition-similarity) compares which AOI-to-AOI moves they made. [Heatmap overlap](#heatmap-overlap) compares where they looked, in any order.

## Output

All scanpath similarity metrics produce a participant-by-participant grid: one similarity score for every pair of participants in the selected group. This output is what the [Scanpath Similarity](/docs/visualizations/scanpath-similarity) visualization consumes; because the result is inherently a property of the whole group, it cannot be reshaped for other plots.

### Invariants
- **Measurement class**: Group-level. The result is inherently a property of a *pair* of participants, where both the row and column axes are the participants themselves. There is no per-participant value to combine across the group; the matrix is already the across-participant result, so no further aggregation applies.
- **Windowing**: Not available: the comparison always covers the whole selected time range. Cropping by a Time of Interest (the Start/End bounds in the Pane) is supported; a fixation is encoded into the scanpath string only if it begins within the range. Heatmap overlap counts the part of each fixation inside the range, like the Fixation Heatmap.

## Scanpath String Encoding

To compare scanpaths, GazePlotter converts each participant's fixation sequence into an AOI-letter string:
- Each active AOI is mapped to a unique letter (the first AOI becomes 'A', the second 'B', and so on).
- Fixations that do not land within any active AOI are encoded using a special hash character (`#`).

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

### Transition Similarity
Compares the mix of AOI transitions two participants made, using the counts of the [Transitions](/docs/metrics/transitions) metric. The score is the cosine of the two count matrices:

`Similarity = Σ (Count_1 × Count_2) / √(Σ Count_1² × Σ Count_2²)`

1 means the same mix of transitions, 0 means none in common. Only the mix counts, not how many transitions or when. Also in GazeAlytics (Chen et al., 2023).

1. **Count mode**: *Visit changes* (default) counts moves between AOIs. *Fixation pairs* also counts staying in an AOI, which pulls the score towards dwell.

A participant without transitions has no value.

### Heatmap Overlap
Compares **where** two participants looked, ignoring order. Needs fixation coordinates, not AOIs. Each participant gets a [Fixation Heatmap](/docs/visualizations/fixation-heatmap) of their share of fixation time, and the overlap sums the smaller share in every cell:

`Similarity = Σ min(Share_1, Share_2)`

1 means identical maps, 0 means no common area. This is SIM, or histogram intersection (Swain & Ballard, 1991; Bylinskii et al., 2019), as in GazeAlytics (Chen et al., 2023).

1. **Radius R (0 = Auto)**: Kernel radius, as on the Fixation Heatmap. A larger radius raises every value, so report it.

Most viewers look at the same central areas, so values sit well above 0. Compare pairs with each other, not with 0; the ScanGraph's Auto threshold does this for you. To see groups in the matrix, order it by similarity and raise the color scale's Min.

## Visualizing the Similarity Matrix

The resulting similarity scores can be explored in two ways under the [Scanpath Similarity](/docs/visualizations/scanpath-similarity) visualization:
1. **Heatmap Matrix**: Displays the full participant-by-participant grid, colored by similarity strength, to identify clusters of participants with similar viewing strategies.
2. **ScanGraph Network**: Represents participants as nodes in a graph. An edge is drawn between two participants only if their similarity score meets a threshold, helping visualize communities of shared attention.

## Reference

The Needleman-Wunsch scoring, the similarity parameter *p*, and the ScanGraph network are based on:

> Doležalová, J., & Popelka, S. (2016). ScanGraph: A novel scanpath comparison method using visualisation of graph cliques. *Journal of Eye Movement Research*, 9(4). [https://doi.org/10.16910/jemr.9.4.5](https://doi.org/10.16910/jemr.9.4.5)

Heatmap overlap and transition similarity follow:

> Swain, M. J., & Ballard, D. H. (1991). Color indexing. *International Journal of Computer Vision*, 7(1), 11–32. [https://doi.org/10.1007/BF00130487](https://doi.org/10.1007/BF00130487)

> Bylinskii, Z., Judd, T., Oliva, A., Torralba, A., & Durand, F. (2019). What do different evaluation metrics tell us about saliency models? *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 41(3), 740–757. [https://doi.org/10.1109/TPAMI.2018.2815601](https://doi.org/10.1109/TPAMI.2018.2815601)

> Chen, K.-T., Prouzeau, A., Langmead, J., Whitelock-Jones, R. T., Lawrence, L., Dwyer, T., Hurter, C., Weiskopf, D., & Goodwin, S. (2023). Gazealytics: A unified and flexible visual toolkit for exploratory and comparative gaze analysis. *Proceedings of the 2023 Symposium on Eye Tracking Research and Applications (ETRA)*. [https://doi.org/10.1145/3588015.3589844](https://doi.org/10.1145/3588015.3589844)
