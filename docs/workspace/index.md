# Workspace Overview

The GazePlotter Workspace is your central analysis dashboard. It operates as an interactive single-page canvas where you can arrange plots, configure metrics, and manage your dataset libraries.

## Workspace Layout & Interface Terms

The app has four parts: the header above, the rail on the left, the canvas, and the pane on the right.

```
+------------------------------------------------------------------------+
|  GazePlotter              Import   Export   Metadata   [Guide & about] |
+------------------------------------------------------------------------+
|     |                                                    |             |
|  R  |                                                    |             |
|  A  |                      CANVAS                        |    PANE     |
|  I  |                    (plot grid)                     |             |
|  L  |                                                    |             |
|     |                                                    |             |
+------------------------------------------------------------------------+
```

### Header
Along the **top edge** of the app:
- **Import**: upload [eye-tracking files](/docs/upload-data/) and [event files](/docs/upload-data/events/), or restore saved [workspace configurations](/docs/export/workspace/). You can also drop files anywhere on the canvas.
- **Export**: save your [workspace configurations](/docs/export/workspace/), [high-resolution figures](/docs/export/figures/), letter-coded [gaze sequences](/docs/export/segmented-data/), or calculated [metric tables](/docs/export/metric-data/).
- **Metadata**: inspect [source and parsing details](/docs/advanced/source-metadata/) for your datasets to troubleshoot format compatibility.
- **Guide & about**: opens this guide.

### Rail
A narrow column on the **left side** of the canvas (a strip along the bottom on phones):
- **Add Visualization** (`+` icon) opens a menu of [plot categories](/docs/visualizations/); the new plot lands in the first free space.
- **Undo** and **Redo**.
- **Zoom to fit** shows every plot at once. Below it, **Zoom in**, the current zoom level (click it to return to 100%), and **Zoom out**.
- On a phone, selecting a plot swaps the strip to **Edit plot settings** and **Deselect**.

### Moving around the canvas
The canvas works like a map:
- **Pan**: drag empty space, drag with the middle mouse button (also over plots), or scroll with the mouse wheel or touchpad (hold `Shift` to scroll sideways). On a touch screen, drag with two fingers.
- **Zoom**: `Ctrl` / `Cmd` + scroll, pinch on a touchpad or touch screen, or `Ctrl` / `Cmd` + `+` / `-`. `Ctrl` / `Cmd` + `0` returns to 100%.
- **Zoom to fit**: `Shift` + `1`, or the button in the rail.
- You can always pan a little past your plots, but never so far that they all leave the screen. If a selected plot is out of view, an arrow at the edge of the canvas points to it; click the arrow to bring the plot back.

### Canvas
The central area of the screen where plots are arranged.
- **Selection**: Click any card to select it (or hold `Cmd` / `Ctrl` / `Shift` to select multiple). Selection opens the Pane and reveals card controls.
- **Canvas Operations**: Drag, resize, duplicate, or delete cards to arrange your grid. For details, see [Plot Manipulation](#plot-manipulation).

### Pane
A collapsible panel located on the **right side** of the screen.
- **Pane Activation**: Opens automatically when you select any plot card on the canvas.
- **Collapsible Settings**: Customize parameters (e.g. *Stimulus*, *Participant selection*, *Participant*, *Time Range*, *Areas of Interest*, *Events*, *Eye-movement Types*, *Metric*). See [Visualization Configuration Pane](/docs/visualizations/#visualization-configuration-pane) for details.
- **Batch Editing**: Modify settings for multiple selected plots simultaneously (mixed plot types only expose shared options).

## Plot Manipulation

To perform any manipulation (moving, resizing, duplicating, or removing), you must select the target plot card first by clicking it. Clicking empty canvas space deselects it.

### Moving a plot
With the plot selected, the whole card is a drag target: click and drag anywhere on the card frame to move it. Plots snap to a 40×40 pixel grid. Hold a plot near the edge of the canvas and the view moves along, so you can place it anywhere, including above or to the left of all other plots. With several plots selected, drag any one to move them all together.

### Resizing a plot
Drag any of the four corner handles on a selected plot. The card snaps to the grid as it resizes.

### Duplicating a plot
Click **Duplicate** in the action chip at the plot's top-left corner. The copy keeps every setting: participant selection, stimulus, axis bounds, colors.

### Removing a plot
Click **Remove** in the action chip at the plot's top-left corner.

## Customization Libraries

GazePlotter includes dedicated libraries to customize and configure how your data is grouped, colored, named, and calculated:

* **[AOI Library](/docs/workspace/aoi-library/)**: Control how Areas of Interest (AOIs) are colored, labeled, merged, and narrowed with selections. Managed per stimulus.
* **[Event Library](/docs/workspace/event-library/)**: Color-code and group event markers, and pair start/end events to derive custom event intervals.
* **[Eye-movement Type Library](/docs/workspace/eye-movement-type-library/)**: Configure and customize classification categories (like fixations, saccades, and blinks) by renaming, recoloring, merging, or saving selections, across the workspace.
* **[Participant Library](/docs/workspace/participant-library/)**: Rename participant labels individually or in bulk (using regular expressions), sort or reorder the active participant sequence, and build [named participant selections](/docs/workspace/participant-library/#participant-selections) for cross-cohort comparisons.
* **[Stimuli Library](/docs/workspace/stimuli-library/)**: Manage stimulus names, perform bulk regex renaming, and reorder stimulus lists.
