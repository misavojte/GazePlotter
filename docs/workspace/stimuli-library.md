# Stimuli Library

The Stimuli Library renames, reorders, and merges stimuli, and manages [stimulus selections](#stimulus-selections). Renaming changes only the displayed label; the original source name is preserved.

## Opening the library

1. Select a plot to open its [Pane](/docs/visualizations/#visualization-configuration-pane).
2. In the **Stimulus** section, click **Edit stimuli & selections**.

## Editing stimuli

Each stimulus is a row showing its original name, an editable **Displayed name**, and a **Media** button. Drag the grip handle to reorder; the order sets how stimuli appear in dropdowns and menus. Two buttons sit above the list:

- **Sort**: Order by original or displayed name, ascending or descending. Sorting uses natural ordering, so `Stimulus_2` comes before `Stimulus_10`.
- **Bulk actions**: Opens **Rename items…** for pattern-based renaming.

Rows are selected as in the [Participant Library](/docs/workspace/participant-library/#selecting-rows).

## Merging stimuli

Stimuli that share the same **Displayed name** merge into one stimulus: their recordings are combined, and the merge stays reversible (rename a row apart to restore the original). Select rows and click **Merge** in the tray, or type matching names. Merging is refused when a participant has recordings on more than one of the stimuli. The row explains why and offers **Undo rename**.

## Stimulus selections

Named stimulus subsets work like [participant selections](/docs/workspace/participant-library/#participant-selections). The [Metric Matrix](/docs/visualizations/metric-matrix/) uses them in its **Stimuli** section.

## Reference media

Each stimulus can carry one reference image or video, drawn behind gaze data as the [Scanpath](/docs/visualizations/scanpath/) background. The [Fixation Heatmap](/docs/visualizations/fixation-heatmap/) draws an image under its map; a video only sets its frame. The **Media** button at the end of a row shows the state: an outlined button means no media, a filled button means media is attached. Click it to open the **Reference Media** dialog. Media changes are saved together with the other stimulus edits when you click **Apply** in the stimuli dialog, and **Cancel** there discards them.

- **No media yet**: Click **Choose image or video…** to attach a file. Media files imported with **Import** attach automatically when named after a stimulus; unmatched files prompt for manual assignment.
- **Media attached**: The dialog shows the file details and a **Replace…** button. A replacement keeps the current position and width; its height follows the new file's proportions. **Remove media** detaches the file.
- **Position in gaze coordinates**: By default, gaze coordinates are assumed to equal media pixels. When the stimulus was offset on screen or recorded at a different scale, set the media's top-left corner (**Left (gaze X)**, **Top (gaze Y)**) and its size (**Width**, **Height**) in gaze units. **Reset to media size** restores the default mapping.

### Aligning media on fixations

When the stimulus has fixations, the **Alignment** section draws them over the media, so you can line the two up by eye:

- **Move**: Drag the media, or use the arrow keys (hold Shift for 10x steps).
- **Resize**: Drag a corner. The proportions stay fixed; hold Shift to change them.
- **Fixations from**: Align against all participants, or one participant's fixations.
- **Fit to fixations**: Places the media, at its own proportions, so it just covers the fixations. A starting point when the media is far off, for example gaze in normalized units.
- **Undo**: Steps back one drag, button, or burst of arrow-key nudges (also Ctrl+Z).
- **View**: Ctrl (or Cmd) + scroll zooms, Ctrl (or Cmd) + drag or dragging empty space pans, and double-click fits the view.

Once the media moves, a dashed outline marks where it started. **Cancel** discards every change.

Attached media is saved with the workspace, inside its [`.gazeplotter` file](/docs/export/workspace/).

## Pattern renaming

For systematic renames, use **Bulk actions → Rename items…**. It finds a regular expression in the displayed names and replaces every match. The wildcard buttons append common tokens (`\d+`, `\s`, `[A-Za-z]`, `.`). For a full walkthrough, see [Pattern renaming](/docs/workspace/participant-library/#pattern-renaming).

Example: turn `SMI Base` into `Base` with pattern `SMI\s` and an empty replacement.

## Saving

Click **Apply** to save, or **Cancel** to discard all changes.
