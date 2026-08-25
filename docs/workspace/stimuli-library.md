# Stimuli Library

The Stimuli Library renames stimuli and sets their order across all plots and dropdowns. Renaming changes only the displayed label; the original source name is preserved.

## Opening the library

1. Select a plot to open its [Pane](/docs/visualizations/#visualization-configuration-pane).
2. In the **Stimulus** section, click **Edit stimuli & selections…**.

## Editing stimuli

Each stimulus is a row showing its original name, an editable **Displayed name**, and a **Media** button. Drag the grip handle to reorder; the order sets how stimuli appear in dropdowns and menus. Two buttons sit above the list:

- **Sort**: Order by original or displayed name, ascending or descending. Sorting uses natural ordering, so `Stimulus_2` comes before `Stimulus_10`.
- **Bulk actions**: Opens **Rename items…** for pattern-based renaming.

## Reference media

Each stimulus can carry one reference image or video, drawn behind gaze data as the [Scanpath](/docs/visualizations/scanpath/) background. The **Media** button at the end of a row shows the state: an outlined button means no media, a filled button means media is attached. Click it to open the **Reference Media** dialog.

- **No media yet**: Click **Choose image or video…** to attach a file. Media files included in an Upload data selection attach automatically when named after a stimulus; unmatched files prompt for manual assignment.
- **Media attached**: The dialog shows a preview, the file details, and a **Replace…** button. **Remove media** detaches the file.
- **Position in gaze coordinates**: By default, gaze coordinates are assumed to equal media pixels. When the stimulus was offset on screen or recorded at a different scale, set the media's top-left corner (**Left (gaze X)**, **Top (gaze Y)**) and its size (**Width**, **Height**) in gaze units. **Reset to image size** restores the default mapping.

Attached media is saved with the workspace: exporting a workspace that contains media produces a `.gazeplotter.zip` archive instead of a plain `.json` file.

## Pattern renaming

For systematic renames, use **Bulk actions → Rename items…**. It finds a regular expression in the displayed names and replaces every match. The wildcard buttons append common tokens (`\d+`, `\s`, `[A-Za-z]`, `.`). For a full walkthrough, see [Pattern renaming](/docs/workspace/participant-library/#pattern-renaming).

Example: turn `SMI Base` into `Base` with pattern `SMI\s` and an empty replacement.

## Saving

Click **Apply** to save, or **Cancel** to discard all changes.
