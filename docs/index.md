# Welcome to GazePlotter Guide & Docs

GazePlotter is a free web application for eye-tracking data analysis and visualization. Built with a commitment to open science, GazePlotter transforms complex gaze data into intuitive, interactive visualizations without requiring registration, subscriptions, or server uploads.

Whether you're a researcher analyzing attention patterns, a student learning about eye-tracking methodology, or a professional presenting gaze data insights, GazePlotter provides tools that work entirely in your browser without installing any other software.

## Analysis Suite

### Multiple Visualization Types

- **[Scarf Plots](/docs/visualizations/scarf-plot/)** - Interactive timeline visualizations showing gaze sequences and patterns over time
- **[AOI Metrics](/docs/visualizations/aoi-metrics/)** - Statistical analysis with metrics like dwell time, fixation count, and time to first fixation
- **[Transition Matrices](/docs/visualizations/transition-matrix/)** - Heat map visualizations of gaze movement patterns between Areas of Interest
- **[Time-binned AOI Occupancy](/docs/visualizations/aoi-occupancy/)** - Flowing visualizations showing the distribution of attention over time
- **[Recurrence Plots](/docs/visualizations/recurrence-plot/)** - N×N matrix revealing temporal self-similarity in a single participant's fixation sequence

### Workspace Management

- **[Workspace Operations](/docs/basic/workspace/)** - Add, duplicate, move, and resize plots with drag-and-drop functionality
- **[Participant Grouping](/docs/basic/groups/)** - Comparative analysis between different participant groups
- **[AOI Customization](/docs/basic/aoi-customization/)** - Full control over colors, names, and visual properties

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

- **New to GazePlotter?** Start with [uploading your data](/docs/upload-data/#upload-data-button) to see your first visualization
- **Ready to analyze?** Explore [basic functionality](/docs/basic/) to learn about plots and customization
- **Need advanced features?** Check out [export options](/docs/export/) and [advanced capabilities](/docs/advanced/)
- **Want to edit your data?** Use [Segmented Data workflows](/docs/advanced/segmented-data-workflows/) to crop segments or split stimuli

## Open Source & Community

GazePlotter is open-source software licensed under GNU GPL v3, ensuring it remains free and transparent forever.

**Contribute & Support:**

- [Code Repository](https://github.com/misavojte/GazePlotter) - Report bugs, request features, or contribute code
- [npm Package](https://www.npmjs.com/package/gazeplotter) - Integrate GazePlotter into your own Svelte projects

**Academic Use:**
If you use GazePlotter in your research, please consider citing our work to support continued development and help other researchers discover this tool.
