# Eye-tracking Visualizations

GazePlotter offers several advanced eye-tracking visualization tools to analyze gaze and attention dynamics.

## Available Plots

- **[Scarf Plot](/docs/visualizations/scarf-plot/)**: A comprehensive chronological sequence chart showing where participants looked over time, with support for event data overlays.
- **[AOI Comparison](/docs/visualizations/aoi-comparison/)**: Quantitative bar charts that aggregate fixation durations, visit counts, dwell times, and other gaze measurements across Areas of Interest (AOIs).
- **[Transition Matrix](/docs/visualizations/transition-matrix/)**: A heat map matrix showing the frequency and probability of gaze transitions between different Areas of Interest (AOIs), highlighting visual flow and search sequences.
- **[AOI Timeline](/docs/visualizations/aoi-timeline/)**: Visualizations (Stream, Distribution, Ridgeline, and Heatmap) showing how attention is distributed across Areas of Interest (AOIs) over time in discrete intervals.
- **[Recurrence Plot](/docs/visualizations/recurrence-plot/)**: An N×N matrix revealing temporal self-similarity, showing when and how often a single participant's gaze returned to the same spatial region.
- **[Scanpath](/docs/visualizations/scanpath/)**: A 2D spatial visualization displaying the sequence of fixations (as circles scaled by duration) and saccades (as connecting lines) directly on top of the stimulus image.
- **[Scanpath Similarity](/docs/visualizations/scanpath-similarity/)**: Comparison of participant scanpaths using sequence alignment algorithms (Levenshtein or Needleman-Wunsch), rendered as a similarity matrix or a ScanGraph network.
- **[Metric Timeline](/docs/visualizations/metric-timeline/)**: A temporal visualization (Heatmap or Line Overlay) showing the progression of a windowed scalar metric (e.g. average fixation duration) across the timeline.
- **[Metric Correlation](/docs/visualizations/metric-correlation/)**: A statistical visualization (Heatmap or Scatter Plot Matrix/Splom) showing correlations (Pearson or Spearman) between multiple scalar metrics across participants.

## Configuration and Settings Pane

Every visualization plot in the workspace is configured via the collapsible **Settings Pane** on the right side of the window (rendered as an overlay bottom sheet on mobile). 

Selecting a plot card automatically opens its corresponding settings inside the pane. Deselecting the plot or clicking the workspace background closes the pane. 

The Settings Pane is structured into collapsible accordion sections:
- **Stimulus**: Selects the target stimulus and provides access to edit the stimulus library.
- **Participant group** / **Participant**: Selects the target group or individual participant for the analysis.
- **Metric**: Configures the underlying metric to calculate and plot. This section integrates directly with the workspace's global Metric Library. Users can select default configurations or define custom metrics.
- **Visualisation**: Contains plot-specific parameters (e.g. orientation, scale ranges, rendering alignments, masking).
- **Time range [ms]** or **Ordinal range [indices]**: Defines temporal boundaries for the plot.
- **Areas of Interest**: Filters which AOIs are visible and links to the global AOI customization interface.
- **Export**: Down at the bottom of the pane, provides a **Download plot…** action to export high-quality images.

> **Plot Configuration**: Every individual visualization plot functions as an independent, interactive card in the workspace. For general actions such as moving, resizing, duplicating, or removing plots, see the [Workspace documentation](/docs/setup/workspace/).

