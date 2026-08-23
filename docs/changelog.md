# Changelog

## 1.9.x

### 1.9.4

* *Released on August 23, 2026*
* **Event Analysis**: Events are now measurable, not just drawable. Added [event metrics](/docs/metrics/events) (per-channel occurrence counts, active time, time shares, occurrence durations, and time to first event) and the [Event Comparison](/docs/visualizations/event-comparison) plot that draws them, one distribution per channel. Channels merged in the [Event Library](/docs/workspace/event-library) are measured as one, and each metric can also be picked at a single channel for the scalar plots, including windowed on the [Metric Timeline](/docs/visualizations/metric-timeline).
* **Scarf Plot**: Hovering an event strip now shows the event's channel, start, end, and duration (or its moment, for instant markers) instead of the gaze segment behind it.
* **Event-only Datasets**: A [Custom CSV event file](/docs/upload-data/events/#custom-csv-event-format) can now be uploaded on its own; the workspace opens with an Event Comparison plot and gaze analysis stays hidden. Symmetrically, datasets without events no longer offer event metrics or the Event Comparison plot: metrics and plots follow what the data actually contains.
* **Internals**: Reworked legend height calculation, unified figure export internals, and prepared the library for embedding in other apps.

### 1.9.3

* *Released on August 11, 2026*
* **Eye-movement Types**: Added [eye-movement type metrics](/docs/metrics/eye-movement) (per-type counts, time budgets, segment durations, and saccadic latency) and the [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison) plot that draws them, one distribution per type. Types merged in the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library) are measured as one, and each metric can also be picked at a single type for the scalar plots.
* **Linked Hovering**: Hovering one plot marks the same moment and the same participant in the others, within a stimulus for moments and across stimuli for participants. See [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).
* **Scanpath Similarity**: The [ScanGraph](/docs/visualizations/scanpath-similarity) network now follows Doležalová and Popelka (2016): article-scored Needleman-Wunsch, so its threshold is the article's *p*, plus a percentage-of-edges reading and clique groups. Levenshtein and Needleman-Wunsch are separate metrics now, each with a collapsed variant.
* **Selections**: The [eye-movement type](/docs/workspace/eye-movement-type-library) and [event](/docs/workspace/event-library) libraries ship *Just fixations* and *No events* as ordinary selections, replacing the built-in picker options; older workspaces are pointed at them automatically.
* **Plots**: [Metric Timeline](/docs/visualizations/metric-timeline) paints only where its metric actually measured.
* **Internals**: A shared distribution layer behind the comparison plots, unified plot highlight marks, and the workspace canvas behaviours split into their own modules.

### 1.9.2

* *Released on July 23, 2026*
* **Merging & Selections**: Redesigned the [AOI](/docs/workspace/aoi-library), [participant](/docs/workspace/participant-library), [stimuli](/docs/workspace/stimuli-library), [event](/docs/workspace/event-library), and [eye-movement type](/docs/workspace/eye-movement-type-library) libraries around one shared mechanism: click rows to select them, then merge, split, or save them as a named selection from the tray. Selections are shared across the workspace and replace both per-plot hide toggles and the older participant groups - a plot narrows to a selection, and everything outside it stays counted (e.g. as No AOI). Event and eye-movement type pickers offer a built-in *None* that turns the layer off (e.g. no event overlay, or a fixations-only Scarf). Workspaces saved with the old hide settings or participant groups open automatically.
* **Plots**: Added the [Metric Matrix](/docs/visualizations/metric-matrix) plot - a participants × stimuli grid showing one scalar metric value per cell, with missing or unusable recordings rendered distinctly for quick data-quality screening. The option to hide No AOI data is now available on Scarf plots as well.
* **Metrics**: Reorganized the [Metric Library](/docs/metrics) picker around what each metric measures, with the produced output shape chosen during metric configuration.
* **Internals**: Removed the legacy hide mechanism, pruned dead code and unused exports across plots, modals, and the data layer, and unified shared components.

### 1.9.1

* *Released on July 09, 2026*
* **Export**: Added [batch plot exporting](/docs/export/figures), a new [metric export](/docs/export/metric-data) replacing the hardcoded metrics export, an export progress bar, and fixed display names in exports.
* **Plots**: Added insufficient height warnings, refined evolving plots, and made Scarf plot automatically reset its time range to 0 when dragged fully. Fixed syncing edge cases.
* **UI**: Redesigned notifications (toasts) with auto-close indicators. Polished visuals for multi-select, tooltips, context menus, and base layout. Improved default AOI colors and simplified the Metric Library header.
* **Performance**: Refactored plot internals for unified rendering and a slight performance gain.

### 1.9.0

* *Released on June 22, 2026*
* **Redesigned Workspace**: Select one or more plots to move, resize, or change their stimulus, participant group, and other settings together (selecting elements opens a dedicated pane to configure all parameters at once). Saved workspaces from earlier versions open automatically.
* **New Visualizations**:
  * [Recurrence Plot](/docs/visualizations/recurrence-plot) - N×N matrix revealing temporal self-similarity in a single participant's fixation sequence.
  * [Scanpath](/docs/visualizations/scanpath) - 2D spatial trajectory overlay plot showing fixation locations, index order, and sequence overlays on the stimulus.
  * [Scanpath Similarity](/docs/visualizations/scanpath-similarity) - Pairwise comparison matrix of sequence alignments with graph-based ScanGraph network thresholding.
  * [Metric Timeline](/docs/visualizations/metric-timeline) - Rolling temporal binned heatmap matrices or line trend overlays tracing scalar metrics.
  * [Metric Correlation](/docs/visualizations/metric-correlation) - Multi-select correlation heatmaps and Scatter Plot Matrices (SPLOM) with Pearson/Spearman algorithms.
* **[Metrics Library](/docs/metrics)**: central DSL engine for configuring, parameterizing, and projecting eye-tracking metrics (dwell time, counts, latency, transitions, RQA, similarity).
* **[Event Ingestion](/docs/upload-data/events)**: upload event files and channels with a central [Event Library](/docs/workspace/event-library) and export event occurrences.
* **[Eye-movement Type Library](/docs/workspace/eye-movement-type-library)**: Customize, rename, and group eye-movement categories (such as fixations, saccades, and unclassified events) using the category customization library.
