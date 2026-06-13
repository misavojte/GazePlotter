# AOI Library

The AOI Library controls the display names, colors, order, and visibility of Areas of Interest (AOIs). AOIs are defined per stimulus.

## Opening the library

1. Select a plot to open its [Settings Pane](/docs/visualizations/#configuration-and-settings-pane).
2. In the **Areas of Interest** section, click **Configure AOI Library…**.

## Choosing the stimulus

AOIs belong to a stimulus. Pick the one to edit from the **For stimulus** dropdown. When you apply changes, you can keep them on this stimulus or propagate them to others (see [Applying changes](#applying-changes)).

## Editing AOIs

Each AOI is a row with these controls:

- **Displayed name** — Rename the AOI. The original source name is kept and shown alongside; only the displayed name changes in plots and legends.
- **Color** — Set the AOI color via the color picker.
- **Visible** — Uncheck to hide the AOI from plots. It stays in the data and can be re-shown anytime.
- **Move handle** — Drag the grip icon to reorder. Order sets the sequence in legends and stacked plots.

Two buttons sit above the list:

- **Sort** — Order rows by original or displayed name, ascending or descending (natural ordering, so `AOI-2` comes before `AOI-10`).
- **Bulk actions** — **Rename items…** (regex find-and-replace on displayed names) and **Change visibility…** (show or hide all AOIs matching a pattern). See [Pattern renaming](/docs/setup/participant-library/#pattern-renaming) for how the regex flyout works.

## Grouping AOIs

AOIs that share the same **Displayed name** merge into one group across all plots. To group AOIs (e.g. `Target 1`, `Target 2`, `Target 3` → `Target`), give them the same displayed name. To split one off, give it a unique name.

The first AOI in a group is the leader: its color and visibility apply to the whole group, and only the leader exposes the color and visibility controls.

## No AOI Hit treatment

Fixations that land outside every AOI are grouped as **No AOI**. Set their display name and color in the **No AOI Hit Treatment** section.

## Applying changes

Choose the scope, then click **Apply** (or **Cancel** to discard):

- **This stimulus** — Apply only to the selected stimulus.
- **All by original name** — Apply to AOIs with matching original names across all stimuli.
- **All by displayed name** — Apply to AOIs with matching displayed names across all stimuli.

Reordering only applies to the selected stimulus; it never propagates to others.

![Workspace plot controls used to open the AOI Library.](/docs/images/1.png)
