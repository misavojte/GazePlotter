# Stimuli Library

The Stimuli Library renames stimuli and sets their order across all plots and dropdowns. Renaming changes only the displayed label; the original source name is preserved.

## Opening the library

1. Select a plot to open its [Settings Pane](/docs/visualizations/#configuration-and-settings-pane).
2. In the **Stimulus** section, click **Edit stimulus library…**.

## Editing stimuli

Each stimulus is a row showing its original name and an editable **Displayed name**. Drag the grip handle to reorder; the order sets how stimuli appear in dropdowns and menus. Two buttons sit above the list:

- **Sort** — Order by original or displayed name, ascending or descending. Sorting uses natural ordering, so `Stimulus_2` comes before `Stimulus_10`.
- **Bulk actions** — Opens **Rename items…** for pattern-based renaming.

## Pattern renaming

For systematic renames, use **Bulk actions → Rename items…**. It finds a regular expression in the displayed names and replaces every match. The wildcard buttons append common tokens (`\d+`, `\s`, `[A-Za-z]`, `.`). For a full walkthrough, see [Pattern renaming](/docs/setup/participant-library/#pattern-renaming).

Example: turn `SMI Base` into `Base` with pattern `SMI\s` and an empty replacement.

## Saving

Click **Apply** to save, or **Cancel** to discard all changes.
