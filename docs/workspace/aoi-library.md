# AOI Library

The AOI Library controls the display names, colors, order, merging, and selections of Areas of Interest (AOIs). AOIs are defined per stimulus.

## Opening the library

1. Select a plot to open its [Pane](/docs/visualizations/#visualization-configuration-pane).
2. In the **Areas of Interest** section, click **Edit AOIs & selections…**.

## Choosing the scope

The dropdown in the list header switches what the list shows and what **Apply** affects:

- **A stimulus** — Edit that stimulus's AOIs, including their order (drag the grip handle).
- **All stimuli** — One row per original AOI name across the whole dataset. Editing a name or color applies to every stimulus containing that original name; untouched rows keep their per-stimulus values. Rearranging the rows (drag or sort) sets one shared order that **every stimulus adopts on Apply** — leave the order untouched and per-stimulus orders stay as they are. The **Stimuli** column shows in how many stimuli the AOI appears (`2/3`), with `*` flagging values that currently differ between stimuli.

## Editing AOIs

Each AOI row shows the original source name, an editable **Displayed name**, and a **Color** picker. The list header holds the scope select, **Sort**, and **Bulk actions → Rename items…** for regex find-and-replace (see [Pattern renaming](/docs/workspace/participant-library/#pattern-renaming)).

## Selecting rows

Click a row to select it (a dashed outline appears); Shift-click selects a range. The tray at the bottom shows what you can do with the selection:

- **Merge** / **Split** — See [Merging AOIs](#merging-aois).
- **Select all / Clear** — Toggle every row at once.
- **Save as selection** — Turns the selected rows into a named [AOI selection](#aoi-selections).
- **Drag** — Dragging any selected row's handle moves the whole selected block together.

Esc clears the selection.

## Merging AOIs

Select rows and click **Merge into "…"** in the tray: the selected AOIs take the first (topmost) selected row's displayed name. AOIs sharing a displayed name are one logical AOI across all plots; the first row of a merged group is the leader and its color applies to the whole group. **Split** reverses it — every member of a selected merged group returns to its original name. Typing matching names merges too.

## AOI selections

A selection is a named subset of AOIs a plot can focus on. In a plot's **Areas of Interest** pane section, picking a selection keeps only those AOIs; fixations on all other AOIs count as **No AOI**, so totals stay honest. There is no separate hide toggle — to hide AOIs from a plot, pick a selection that leaves them out. Selections are shared across the workspace, so one "without X" selection can be applied to any number of plots (select several plots to set it on all of them at once).

Selections live in the *Selections* row beneath the list and are edited directly on the list — the layout never changes:

- **Create** — Select rows and click **+ Save as selection**, or click **+ New** and then click AOI cards to include them.
- **Edit** — Click a selection's chip: its members show a solid outline (solid = saved, dashed = temporary), clicking cards toggles them, and the tray bubble renames it and shows the live count. Finish by clicking the chip again, pressing Esc, or clicking anywhere else. **Dissolve selection** removes the named subset; the AOIs themselves stay untouched.
- **Combine** — With rows selected, clicking a chip offers **Add selected** / **Remove selected** for that selection.
- **Peek** — Hover an idle chip to see its members outlined without entering editing.
- **Delete** — Plots that used a deleted selection fall back to *All AOIs*.

Selections match post-merge displayed names across all stimuli (the bubble notes members that live on other stimuli), and they follow renames: renaming or merging an AOI keeps its selections intact.

## No AOI

Fixations that land outside every AOI are grouped as **No AOI**. Its display name and color are the pinned row at the bottom of the list.

## Saving

Click **Apply** to save every change staged in the modal (edits in the current scope, the No AOI row, and selections), or **Cancel** to discard all of it.

![Workspace plot controls used to open the AOI Library.](/docs/images/1.png)
