# Eye-tracking Visualizations

GazePlotter offers several advanced eye-tracking visualization tools to analyze gaze and attention dynamics.

## Available Plots

- **[Scarf Plot](/docs/visualizations/scarf-plot/)**: A comprehensive chronological sequence chart showing where participants looked over time, with support for event data overlays.
- **[AOI Comparison](/docs/visualizations/aoi-comparison/)**: Quantitative bar charts that aggregate fixation durations, visit counts, dwell times, and other gaze measurements across Areas of Interest (AOIs).
- **[Eye-movement Comparison](/docs/visualizations/eye-movement-comparison/)**: The same comparison along the eye-movement type axis instead of the AOI axis: one distribution per type (fixation, saccade, blink) for counts, time budgets, segment durations, and saccadic latency.
- **[Transition Matrix](/docs/visualizations/transition-matrix/)**: A heat map matrix showing the frequency and probability of gaze transitions between different Areas of Interest (AOIs), highlighting visual flow and search sequences.
- **[AOI Timeline](/docs/visualizations/aoi-timeline/)**: Visualizations (Stream, Distribution, Ridgeline, and Heatmap) showing how attention is distributed across Areas of Interest (AOIs) over time in discrete intervals.
- **[Recurrence Plot](/docs/visualizations/recurrence-plot/)**: An N×N matrix revealing temporal self-similarity, showing when and how often a single participant's gaze returned to the same spatial region.
- **[Scanpath](/docs/visualizations/scanpath/)**: A 2D spatial visualization displaying the sequence of fixations (as circles scaled by duration) and saccades (as connecting lines) directly on top of the stimulus image.
- **[Scanpath Similarity](/docs/visualizations/scanpath-similarity/)**: Comparison of participant scanpaths using sequence alignment algorithms (Levenshtein or Needleman-Wunsch), rendered as a similarity matrix or a ScanGraph network.
- **[Metric Timeline](/docs/visualizations/metric-timeline/)**: A temporal visualization (Heatmap or Line Overlay) showing the progression of a windowed scalar metric (e.g. average fixation duration) across the timeline.
- **[Metric Correlation](/docs/visualizations/metric-correlation/)**: A statistical visualization (Heatmap or Scatter Plot Matrix/Splom) showing correlations (Pearson or Spearman) between multiple scalar metrics across participants.
- **[Metric Matrix](/docs/visualizations/metric-matrix/)**: A participants × stimuli grid showing one scalar metric value per recording, with missing or unusable recordings rendered distinctly for data-quality screening.

## Linked Hovering Across Plots

Hovering one plot marks the same data in the others, so a moment or a person can be followed across the whole workspace without clicking. Two independent channels travel together:

- **Moment**: the time under the pointer, marked as a dashed vertical guide. Times are comparable only within one stimulus, so the guide appears only on plots showing the same stimulus, and only where their axis is elapsed milliseconds; a [Scarf Plot](/docs/visualizations/scarf-plot/) switched to *Ordinal* or *Relative* neither sends nor receives a moment. Sent by the Scarf Plot, [AOI Timeline](/docs/visualizations/aoi-timeline/), [Metric Timeline](/docs/visualizations/metric-timeline/), and the [Recurrence Plot](/docs/visualizations/recurrence-plot/), whose cell designates two moments and marks both.
- **Participant**: the participant under the pointer, marked wherever that person is drawn. This channel deliberately crosses stimuli, since seeing one person's row on another stimulus is the point of it. Sent by the Scarf Plot, Metric Timeline, [Scanpath](/docs/visualizations/scanpath/), Recurrence Plot, [Scanpath Similarity](/docs/visualizations/scanpath-similarity/) (a matrix cell or a network edge designates two people and marks both), and [Metric Matrix](/docs/visualizations/metric-matrix/). It is marked in those plots and in the [Metric Correlation](/docs/visualizations/metric-correlation/) scatter matrix.

The mark is the same dashed highlight a plot already uses for its own pointer feedback: a row or column strip in a matrix, a ring on a network node or a scatter dot, and an inset outline on plots that are one participant (Scanpath, Recurrence). Highlights are screen-only and never appear in [exported figures](/docs/export/figures/).

## Visualization Configuration Pane

Every visualization plot in the workspace is configured via the collapsible **Pane** on the right side of the window (rendered as an overlay bottom sheet on mobile). 

Selecting a plot card automatically opens its corresponding settings inside the pane. Deselecting the plot or clicking the workspace background closes the pane. 

The Pane is structured into collapsible accordion sections:
- **Stimulus**: Selects the target stimulus and provides access to edit the stimulus library and selections.
- **Participants** / **Participant**: Selects the participant selection or individual participant for the analysis.
- **Metric**: Configures the underlying metric to calculate and plot. This section integrates directly with the workspace's global Metric Library. Users can select default configurations or define custom metrics.
- **Visualisation**: Contains plot-specific parameters (e.g. orientation, scale ranges, rendering alignments, masking).
- **Time range [ms]** or **Ordinal range [indices]**: Defines temporal boundaries for the plot.
- **Areas of Interest**: Picks the AOI selection this plot ranges over and links to the global AOI customization interface. Plots with eye-movement or event layers get matching **Eye-movement Types** and **Events** sections with the same selection-picker shape. Those two libraries each ship a ready-made selection for the narrowed case: *Just fixations*, which keeps only the fixation baseline (the AOI layer on a Scarf, a single Fixation distribution on the Eye-movement Comparison), and *No events*, which turns the event overlay off. Both are ordinary selections you can rename or delete.
- **Export**: Down at the bottom of the pane, provides a **Download plot…** action that opens the [figure export dialog](/docs/export/figures/) preselected with this plot.

> **Plot Configuration**: Every individual visualization plot functions as an independent, interactive card in the workspace. For general actions such as moving, resizing, duplicating, or removing plots, see the [Workspace documentation](/docs/workspace/).

