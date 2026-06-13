# Workspace

The workspace is your analysis area. It holds multiple plots at once, arranged on a grid you can rearrange freely.

## Initial Layout

Uploading data creates four plots automatically:

- **[Scarf Plot](/docs/visualizations/scarf-plot/)** — gaze sequences over time.
- **[AOI Metrics](/docs/visualizations/aoi-metrics/)** — bar charts of per-AOI metrics.
- **[Transition Matrix](/docs/visualizations/transition-matrix/)** — heat map of gaze transitions between AOIs.
- **[Time-binned AOI Occupancy](/docs/visualizations/aoi-occupancy/)** — attention distribution over time.

## Workspace toolbar

The workspace has two control areas:

- **Top bar**: **Import** (upload data or a workspace file), **Export** ([export workspace or data](/docs/export/)), and **Metadata** ([source and parsing details](/docs/advanced/source-metadata/)).
- **Side rail**: **Undo**, **Redo**, **Reset Layout** (re-tile all plots into a clean grid), and **Add Visualization**.

### Adding Visualizations

**Add Visualization** opens a menu to add any plot type: Scarf Plot, AOI Metrics, Transition Matrix, Time-binned AOI Occupancy, [Recurrence Plot](/docs/visualizations/recurrence-plot/), [Scanpath Plot](/docs/visualizations/scanpath/), [Scanpath Similarity](/docs/visualizations/scanpath-similarity/), [Evolving Metrics](/docs/visualizations/evolving-metrics/), and [Metric Correlation](/docs/visualizations/metric-correlation/). New plots are placed in the first free space on the grid.

## Plot Manipulation

Each plot is an independent card. Click a card to select it — on desktop this also opens its [Settings Pane](/docs/visualizations/#configuration-and-settings-pane). Selecting a plot reveals its move, resize, and action controls.

_(To change what a plot displays, see the docs for that plot type, e.g. [Scarf Plot](/docs/visualizations/scarf-plot/).)_

### Moving a plot

Once selected, the whole card becomes a drag target — click and drag anywhere on the card frame to move it. Plots snap to a 40×40 pixel grid, and the canvas expands when you drag toward an edge. Hold **Cmd/Ctrl/Shift** and click to select several plots, then drag any one to move them together.

![Dragging a plot across the GazePlotter workspace grid.](/docs/images/how-to-move-plot-gazeplotter.jpg)

### Resizing a plot

Drag any of the four corner handles on a selected plot. The card snaps to the grid as it resizes.

![Resizing a plot from a corner in the workspace.](/docs/images/how-to-resize-plot-gazeplotter.jpg)

### Duplicating a plot

Click **Duplicate** in the action chip at the plot's top-left corner. The copy keeps every setting — participant group, stimulus, axis bounds, colors.

![Using the Duplicate button to copy a plot in the workspace.](/docs/images/how-to-duplicate-plot-gazeplotter.jpg)

### Removing a plot

Click **Remove** in the same action chip.

![Using the Remove button to delete a plot from the workspace.](/docs/images/how-to-remove-plot-gazeplotter.jpg)

## Saving your work

The workspace is not saved automatically. Use [Workspace Export](/docs/export/workspace/) to save the full state — grid layout, every plot setting, and all library customizations (participant groups, AOI names and colors, participant and stimulus names) — to a JSON file you can re-import later or share.
