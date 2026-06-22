# Workspace

The workspace is your analysis area. It holds multiple plots at once, arranged on a grid you can rearrange freely.

## Initial Layout

Uploading data creates four plots automatically:

- **[Scarf Plot](/docs/visualizations/scarf-plot/)** — gaze sequences over time.
- **[AOI Comparison](/docs/visualizations/aoi-comparison/)** — bar charts of per-AOI metrics.
- **[Transition Matrix](/docs/visualizations/transition-matrix/)** — heat map of gaze transitions between AOIs.
- **[AOI Timeline](/docs/visualizations/aoi-timeline/)** — attention distribution over time.

## Workspace toolbar

The workspace has two control areas:

- **Top bar**: **Import** (upload data or a workspace file), **Export** ([export workspace or data](/docs/export/)), and **Metadata** ([source and parsing details](/docs/advanced/source-metadata/)).
- **Side rail**: **Undo**, **Redo**, **Reset Layout** (re-tile all plots into a clean grid), and **Add Visualization**.

### Adding Visualizations

**Add Visualization** opens a menu to add any plot type: Scarf Plot, AOI Comparison, Transition Matrix, AOI Timeline, [Recurrence Plot](/docs/visualizations/recurrence-plot/), [Scanpath](/docs/visualizations/scanpath/), [Scanpath Similarity](/docs/visualizations/scanpath-similarity/), [Metric Timeline](/docs/visualizations/metric-timeline/), and [Metric Correlation](/docs/visualizations/metric-correlation/). New plots are placed in the first free space on the grid.

## Plot Manipulation

Plots are manipulated by selection: nothing acts on a plot until you select it. Click a card to select it — this reveals its move and resize handles and its action chip (**Duplicate**, **Remove**), and on desktop opens its **Settings Pane**. Click empty grid space to deselect.

Hold **Cmd/Ctrl/Shift** and click to add more plots to the selection. The controls and the pane then act on all of them at once: move, resize, or change their stimulus, participant group, and other settings together.

### Editing a plot

On desktop, selecting a plot opens its [Settings Pane](/docs/visualizations/#configuration-and-settings-pane) — a side column of collapsible sections for everything the plot shows (stimulus, participant group, metric, axes, colors). The available settings depend on the plot type and are documented on its own page, e.g. [Scarf Plot](/docs/visualizations/scarf-plot/).

With more than one plot selected the pane edits the whole selection at once: same-type plots expose their full pane, mixed types only their shared sections — **Stimulus**, **Participant group**, **Participant**, **Time range**, **Areas of Interest**, **Events**, and **Eye-movement Type**. A field whose plots disagree shows **Mixed**; setting it applies to all of them.

### Moving a plot

With the plot selected, the whole card is a drag target — click and drag anywhere on the card frame to move it. Plots snap to a 40×40 pixel grid, and the canvas expands when you drag toward an edge. With several plots selected, drag any one to move them all together.

### Resizing a plot

Drag any of the four corner handles on a selected plot. The card snaps to the grid as it resizes.

### Duplicating a plot

Click **Duplicate** in the action chip at the plot's top-left corner. The copy keeps every setting — participant group, stimulus, axis bounds, colors.

### Removing a plot

Click **Remove** in the same action chip.

## Saving your work

The workspace is not saved automatically. Use [Workspace Export](/docs/export/workspace/) to save the full state — grid layout, every plot setting, and all library customizations (participant groups, AOI names and colors, participant and stimulus names) — to a JSON file you can re-import later or share.
