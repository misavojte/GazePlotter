# Changelog

## 1.9.x

### 1.9.1

* *Released on July 07, 2026*
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
