# Eye-movement Type Library

The Eye-movement Type Library controls the display names, colors, order, merging, and selections of eye-movement categories (such as fixations, saccades, and unclassified events). Classification categories are defined globally across the workspace.

For how to choose categories during data export, see [Segmented Data Export](/docs/export/segmented-data/).

## Opening the library

1. Select any plot to open its [Pane](/docs/visualizations/#visualization-configuration-pane).
2. In the **Eye-movement Types** section, click **Edit eye-movement types & selections…**.

## Editing categories

Each classification category is represented as a row in the library modal with the following controls:

- **Displayed name** — Rename the category (e.g., changing raw source names like "0" or "Fix" to "Fixation"); the original imported name is preserved.
- **Color** — Set the category's visualization color in scarf timelines and other charts.
- **Move handle** — Drag to reorder categories. The order sets the sequence in plot legends and timeline stacks.

The **Sort** and **Bulk actions** buttons above the list work similarly to other libraries, allowing you to sort categories by name or rename items using regular expressions. Select rows to merge or split them, or save them as a named selection in the tray below the list. Each plot picks a selection in its pane's **Eye-movement Types** section to narrow which types it draws — Fixation included, so a selection without it hides the fixation layer too. There is no separate hide toggle; the built-in *None* draws no eye-movement types at all, and a "Fixations only" view is a saved selection holding just Fixation. Fixation's displayed name is reserved (it anchors every AOI-based metric), so it can be recolored and selected but never renamed or merged.

## Grouping categories

Categories that share the same **Displayed name** merge into one group. The first category is the leader and controls the group's color. This is identical to [AOI merging](/docs/workspace/aoi-library/#merging-aois).

## Applying changes

Click **Apply** to save your customizations, or **Cancel** to discard them. Changes apply globally to all stimuli and participants across the active workspace.
