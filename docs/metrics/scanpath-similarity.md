---
title: Scanpath Similarity
order: 6
---

# Scanpath Similarity

Scanpath similarity metrics quantify the spatial and temporal similarity between the gaze trajectories of different participants. In GazePlotter, this comparison is computed pairwise, representing the alignment of scanpaths across the entire group.

---

## Output Shape and Projections Translation

All scanpath similarity metrics naturally output a `participant-pair-matrix` (an M×M grid representing pairwise similarity scores, where M is the number of active participants). Because the output is inherently group-level, no further dimensional projection is supported.

### 1. Matrix Passthrough (`participant-pair-matrix`)
You can pass the matrix through directly to analyze the similarity relationships between all pairs of participants in the selected group:
- **Identity (`identity-participant-pair-matrix`)**: Outputs the M×M similarity matrix.

> **Visualizer Compatibility**: Passing the raw matrix through allows you to select scanpath similarity in the [Scanpath Similarity](/docs/visualizations/scanpath-similarity) visualization (non-windowed). It cannot be projected to other shapes and cannot be selected in other plots.

### Invariants
- **Group Aggregation**: Disabled (`supportsGroupAggregation: false`). The computed matrix is inherently group-level, where both the row and column axes represent the participants. Reducing this across participants would collapse the very axes defining the similarity relationships.
- **Windowing**: Forbidden (`supportsWindowing: false`). Sliding-window projections are not supported. However, cropping by a Time of Interest (using `timeStart` and `timeEnd` bounds in the Settings Pane) is supported; fixations are encoded into the scanpath string only if their onset falls within the range.

---

## Scanpath String Encoding

To compare scanpaths, GazePlotter converts each participant's fixation sequence into an AOI-letter string:
- Each active AOI is mapped to a unique character (e.g., AOI 0 -> 'A', AOI 1 -> 'B').
- Off-AOI fixations that do not land within any active boundary are encoded using a special hash character (`#`).

---

## Metric Recipes

### 1. Participant Pair Similarity (`participantPairSimilarity`)
Computes the similarity score for every pair of participant scanpaths. The resulting matrix is symmetric (similarity from participant i to j equals j to i) and has a diagonal of 1.0 (every participant is identical to themselves).

#### Parameters

1. **Similarity Method (`method`)**:
   - **Levenshtein (`levenshtein`)**: Calculates the minimum edit distance (insertions, deletions, and substitutions) required to transform one scanpath string into the other. The score is normalized by the maximum length of the two scanpaths:
     
     `Similarity = 1 - (Edit Distance / max(Length_1, Length_2))`
     
   - **Needleman-Wunsch (`needlemanWunsch`)**: A dynamic programming algorithm for global sequence alignment. It scores alignments using standard parameter weights (Match = +1, Mismatch = -1, Gap Penalty = -1) and normalizes the final alignment score to fit a `0–1` scale.

2. **Collapsed Scanpaths (`collapsed`)**:
   - `false` (default): Consecutive fixations inside the same AOI are preserved. A participant who fixates AOI A three times before moving to B is encoded as "AAAB".
   - `true`: Consecutive identical AOI entries are collapsed into a single character ("AAAB" $\rightarrow$ "AB"). This removes duration-based variance, isolating the analysis to focus purely on the structural order of visited regions.

---

## Visualizing the Similarity Matrix

The resulting similarity scores can be explored in two ways under the [Scanpath Similarity](/docs/visualizations/scanpath-similarity) visualization:
1. **Heatmap Matrix**: Displays the raw N×N grid, colored by similarity strength, to identify clusters of participants with similar viewing strategies.
2. **ScanGraph Network**: Represents participants as nodes in a graph. An edge is drawn between two participants only if their similarity score exceeds a user-defined threshold, helping visualize communities of shared attention.
