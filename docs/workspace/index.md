# Workspace Overview

The GazePlotter Workspace is your central analysis dashboard. It operates as an interactive single-page canvas where you can arrange plots, configure metrics, and manage your dataset libraries.

## Workspace Layout & Interface Terms

The workspace is divided into four main functional zones:

```
+------------------------------------------------------------------------+
|                                 RIBBON                                 |
+------------------------------------------------------------------------+
|     |                                                      |           |
|  R  |                           CANVAS                     |     P     |
|  A  |                        (Plot Grid)                   |     A     |
|  I  |                                                      |     N     |
|  L  |                                                      |     E     |
|     |                                                      |           |
+------------------------------------------------------------------------+
```

### Ribbon
Located along the **top edge** of the workspace. It houses the global operations for your active analysis:
- **Import** — Click to upload [eye-tracking files](/docs/upload-data/) and [event files](/docs/upload-data/events/), or restore saved [workspace configurations](/docs/export/workspace/).
- **Export** — Save your [workspace configurations](/docs/export/workspace/), [high-resolution figures](/docs/export/figures/), letter-coded [gaze sequences](/docs/export/segmented-data/), or calculated [metric tables](/docs/export/metric-data/).
- **Metadata** — Inspect [source and parsing details](/docs/advanced/source-metadata/) for your datasets to troubleshoot format compatibility.

### Rail
Located on the **left side** of the screen (on desktop) or at the **sticky bottom** (on mobile). 
- **Add Visualizations** — Click the **Add Visualization** button (`+` icon) to open a menu of [plot categories](/docs/visualizations/). Selecting a plot type from this menu adds it to the first free space on the grid.
- **Canvas Operations** — Access buttons for **Undo** (revert the last action), **Redo** (re-apply undone actions), and **Reset Layout** (re-tile all plots into a clean grid).

### Canvas
The central area of the screen where plots are arranged.
- **Selection** — Click any card to select it (or hold `Cmd` / `Ctrl` / `Shift` to select multiple). Selection opens the Pane and reveals card controls.
- **Canvas Operations** — Drag, resize, duplicate, or delete cards to arrange your grid. For details, see [Plot Manipulation](#plot-manipulation).

### Pane
A collapsible panel located on the **right side** of the screen.
- **Pane Activation** — Opens automatically when you select any plot card on the canvas.
- **Collapsible Settings** — Customize parameters (e.g. *Stimulus*, *Participant Group*, *Participant*, *Time Range*, *Areas of Interest*, *Events*, *Eye-movement Classification*, *Metric*). See [Visualization Configuration Pane](/docs/visualizations/#visualization-configuration-pane) for details.
- **Batch Editing** — Modify settings for multiple selected plots simultaneously (mixed plot types only expose shared options).

## Plot Manipulation

To perform any manipulation (moving, resizing, duplicating, or removing), you must select the target plot card first by clicking it. Clicking empty canvas space deselects it.

### Moving a plot
With the plot selected, the whole card is a drag target — click and drag anywhere on the card frame to move it. Plots snap to a 40×40 pixel grid, and the canvas expands when you drag toward an edge. With several plots selected, drag any one to move them all together.

### Resizing a plot
Drag any of the four corner handles on a selected plot. The card snaps to the grid as it resizes.

### Duplicating a plot
Click **Duplicate** in the action chip at the plot's top-left corner. The copy keeps every setting — participant group, stimulus, axis bounds, colors.

### Removing a plot
Click **Remove** in the action chip at the plot's top-left corner.

## Customization Libraries

GazePlotter includes dedicated libraries to customize and configure how your data is grouped, colored, named, and calculated:

* **[AOI Library](/docs/workspace/aoi-library/)** — Control how Areas of Interest (AOIs) are colored, labeled, grouped, and hidden. Managed per stimulus.
* **[Event Library](/docs/workspace/event-library/)** — Color-code and group event markers, and pair start/end events to derive custom event intervals.
* **[Eye-movement Type Library](/docs/workspace/eye-movement-type-library/)** — Configure and customize classification categories (like fixations, saccades, and blinks) by renaming, recoloring, or hiding them globally.
* **[Participant Library](/docs/workspace/participant-library/)** — Rename participant labels individually or in bulk (using regular expressions), sort or reorder the active participant sequence, and build [named participant selections](/docs/workspace/participant-library/#participant-selections) for cross-cohort comparisons.
* **[Stimuli Library](/docs/workspace/stimuli-library/)** — Manage stimulus names, perform bulk regex renaming, and reorder stimulus lists.
