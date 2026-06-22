# Welcome to GazePlotter Guide & Docs

GazePlotter is a free web application for eye-tracking data analysis and visualization. Built with a commitment to open science, GazePlotter transforms complex gaze data into intuitive, interactive visualizations without requiring registration, subscriptions, or server uploads.

Whether you're a researcher analyzing attention patterns, a student learning about eye-tracking methodology, or a professional presenting gaze data insights, GazePlotter provides tools that work entirely in your browser without installing any other software.

> **New in 1.9.0**: A redesigned workspace — [select one or more plots](/docs/setup/workspace) to move, resize, or change their stimulus, participant group, and other settings together. New visualizations: [Recurrence Plot](/docs/visualizations/recurrence-plot), [Scanpath](/docs/visualizations/scanpath), [Scanpath Similarity](/docs/visualizations/scanpath-similarity), [Metric Timeline](/docs/visualizations/metric-timeline), and [Metric Correlation](/docs/visualizations/metric-correlation). A reusable [Metrics Library](/docs/metrics), [event files and channels](/docs/upload-data/events) with an [Event Library](/docs/setup/event-library), and [event occurrence export](/docs/export). Saved workspaces from earlier versions open automatically.

## Analysis Suite

### Multiple Visualization Types

- **[Scarf Plot](/docs/visualizations/scarf-plot)** - Interactive timeline visualizations showing gaze sequences and events over time.
- **[AOI Comparison](/docs/visualizations/aoi-comparison)** - Statistical analysis bar charts with metrics like dwell time, fixation count, and time to first fixation.
- **[Transition Matrix](/docs/visualizations/transition-matrix)** - Heat map visualizations of gaze movement patterns between Areas of Interest.
- **[AOI Timeline](/docs/visualizations/aoi-timeline)** - Flowing river, stacked distribution, ridgeline, or heatmap binned visualizations over time.
- **[Recurrence Plot](/docs/visualizations/recurrence-plot)** - N×N matrix revealing temporal self-similarity in a single participant's fixation sequence.
- **[Scanpath](/docs/visualizations/scanpath)** - 2D spatial trajectory overlay plot showing fixation locations, index order, and sequence overlays on the stimulus.
- **[Scanpath Similarity](/docs/visualizations/scanpath-similarity)** - Pairwise comparison matrix of sequence alignments with graph-based ScanGraph network thresholding.
- **[Metric Timeline](/docs/visualizations/metric-timeline)** - Rolling temporal binned heatmap matrices or line trend overlays tracing scalar metrics.
- **[Metric Correlation](/docs/visualizations/metric-correlation)** - Multi-select correlation heatmaps and Scatter Plot Matrices (SPLOM) with Pearson/Spearman algorithms.

### Metrics Library

- **[Metrics Library Overview](/docs/metrics)** - Central DSL engine for configuring, parameterizing, and projecting eye-tracking metrics.
- **[Fixation & Dwell Durations](/docs/metrics/durations)** - Duration-based calculations like absolute time, relative time, and average/first/visit durations.
- **[Gaze Counts & Latency](/docs/metrics/counts-latency)** - Gaze frequency metrics (fixations, visits) and Time to First Fixation (TTFF) latency.
- **[Transitions & Markov Metrics](/docs/metrics/transitions)** - Shift counts, k-step Markov probabilities, and cell/row/col projections.
- **[Recurrence Quantitative Analysis (RQA)](/docs/metrics/rqa)** - Non-linear recurrences, laminarity, and determinism metrics.
- **[Scanpath Similarity Metrics](/docs/metrics/scanpath-similarity)** - Sequence alignment similarity calculations (Levenshtein, Needleman-Wunsch).

### Workspace Management

- **[Workspace Operations](/docs/setup/workspace)** - Add, duplicate, move, and resize plots with drag-and-drop functionality.
- **[Participant Groups](/docs/setup/participant-groups)** - Comparative analysis between different participant groups.
- **[AOI Library](/docs/setup/aoi-library)** - Full control over colors, names, and visual properties.

### Universal Data Compatibility

GazePlotter supports data from all major eye-tracking platforms:

- **[Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/)** - Full feature support with dynamic AOI visibility
- **[SMI BeGaze](/docs/upload-data/smi-begaze/)** - Complete compatibility including overlapping AOI handling
- **[OGAMA](/docs/upload-data/ogama/)** - Sequence analysis support
- **[GazePoint](/docs/upload-data/gazepoint/)** - Direct data import
- **[Varjo](/docs/upload-data/varjo/)** - VR/AR eye-tracking data
- **[Pupil Cloud](/docs/upload-data/pupil-cloud/)** - Multi-surface support with AOI mapping
- **[Custom CSV](/docs/upload-data/custom-csv/)** - Flexible format for any eye-tracker

### Data Export

- **[Export Options](/docs/export/)** - Save and share workspaces, export data, and integrate with ScanGraph

## Privacy & Accessibility

- **Complete Privacy** - All processing happens locally in your browser; no data ever leaves your device
- **No Registration** - Start analyzing immediately without accounts or sign-ups
- **Progressive Web App** - [Install as desktop app](/docs/advanced/download-gazeplotter/) or use directly in browser
- **Cross-Platform** - Works on Windows, Mac, Linux, and mobile devices
- **Offline Capable** - Continue working without internet connection

## Getting Started

Ready to visualize your eye-tracking data? Choose your path:

- **New to GazePlotter?** Start by [uploading your data](/docs/upload-data) to configure your first visualization.
- **Ready to analyze?** Explore [Workspace & Setup overview](/docs/setup) to learn about workspace setup and custom participant groups.
- **Want to calculate metrics?** Learn how to customize calculations using the [Metrics Library](/docs/metrics) to define durations, counts, transitions, and sequence alignments.
- **Ready to visualize?** Review our full list of [Eye-tracking Visualizations](/docs/visualizations) to configure plot options.
- **Need to export?** Check out [export options](/docs/export) for workspaces, segmented data, or similarity matrices.
- **Want to edit your data?** Use [Segmented Data workflows](/docs/advanced/segmented-data-workflows) to crop segments or split stimuli.

## Open Source & Community

GazePlotter is open-source software licensed under GNU GPL v3, ensuring it remains free and transparent forever.

**Contribute & Support:**

- [Code Repository](https://github.com/misavojte/GazePlotter) - Report bugs, request features, or contribute code
- [npm Package](https://www.npmjs.com/package/gazeplotter) - Integrate GazePlotter into your own Svelte projects

**Academic Use:**
If you use GazePlotter in your research, please consider citing our work to support continued development and help other researchers discover this tool.
