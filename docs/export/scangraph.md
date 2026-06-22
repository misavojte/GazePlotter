# ScanGraph Export

ScanGraph Export writes fixation sequences as letter-coded strings in a `.txt` file for analysis in [ScanGraph](http://eyetracking.upol.cz/scangraph), an external scanpath-similarity tool.

> ScanGraph-style network analysis is already built into GazePlotter — the [Scanpath Similarity plot](/docs/visualizations/scanpath-similarity/) has a **ScanGraph** network view, powered by the [Scanpath Similarity metrics](/docs/metrics/scanpath-similarity/). Use this export only if you want to run the standalone ScanGraph tool.

## Output format

- Each AOI is assigned a letter; each participant's fixations become a string of those letters.
- The file header lists the legend (which letter maps to which AOI, and `#` for no fixation), followed by one sequence per participant.

## Exporting

1. Click **Export** in the workspace top bar.
2. In **Research Data Formats**, click the **ScanGraph Format** card.
3. Select the **Stimulus** and enter a **File name**.
4. Click **Export ScanGraph**.

## Using it in ScanGraph

1. Open the [ScanGraph web app](http://eyetracking.upol.cz/scangraph).
2. Upload the exported `.txt` file.
3. Run the analysis to generate similarity networks and visualizations.

![ScanGraph interface with uploaded sequence data.](/docs/images/scangraph-1.png)
