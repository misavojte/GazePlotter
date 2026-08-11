# Event Library

The Event Library controls the display names, colors, order, merging, and selections of event channels. Channels are defined per stimulus; selections are keyed by displayed name, so they are portable across stimuli.

For how to upload event data, see [Event Data](/docs/upload-data/events/).

## Opening the library

1. Select a Scarf Plot to open its [Pane](/docs/visualizations/#visualization-configuration-pane).
2. In the **Events** section, click **Edit events & selections…**.

Pick the stimulus to edit from the **For stimulus** dropdown.

## Editing channels

Each channel is a row with the same controls as the [AOI Library](/docs/workspace/aoi-library/):

- **Displayed name** — Rename the channel; the original name is preserved.
- **Color** — Set the line color.
- **Move handle** — Drag to reorder. Order sets the sequence in legends and in the event lines beneath each scarf row.

The **Sort** and **Bulk actions** buttons above the list work the same as in the AOI Library (sort by name, regex rename). Select rows to merge or split them, or save them as a named selection in the tray below the list. Each plot picks a selection in its pane's **Events** section to narrow which channels it overlays — there is no separate hide toggle; pick the shipped *No events* selection, which holds no channels, to turn the overlay off, or a selection that leaves the unwanted channels out.

## Grouping channels

Channels that share the same **Displayed name** merge into one group. The first channel is the leader and controls the group's color. This is identical to [AOI merging](/docs/workspace/aoi-library/#merging-aois).

## Creating interval channels

**Create intervals…** derives new interval channels from existing event markers — for example, pairing start/end markers into visibility intervals. The original imported events are never modified; interval channels are added alongside them.

## Applying changes

Click **Apply** to save, or **Cancel** to discard. Unlike the AOI Library, the Event Library applies only to the selected stimulus — there is no cross-stimulus propagation.
