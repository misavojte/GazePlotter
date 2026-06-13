---
title: Event Library
order: 9
---

# Event Library

The Event Library controls the display names, colors, order, and visibility of event channels. Channels are defined per stimulus.

For how to upload event data, see [Event Data](/docs/upload-data/events/).

## Opening the library

1. Select a Scarf Plot to open its [Settings Pane](/docs/visualizations/#configuration-and-settings-pane).
2. In the **Events** section, click **Configure Event Library…**.

Pick the stimulus to edit from the **For stimulus** dropdown.

## Editing channels

Each channel is a row with the same controls as the [AOI Library](/docs/setup/aoi-library/):

- **Displayed name** — Rename the channel; the original name is preserved.
- **Color** — Set the line color.
- **Visible** — Uncheck to hide the channel from the scarf plot.
- **Move handle** — Drag to reorder. Order sets the sequence in legends and in the event lines beneath each scarf row.

The **Sort** and **Bulk actions** buttons above the list work the same as in the AOI Library (sort by name, regex rename, bulk show/hide).

## Grouping channels

Channels that share the same **Displayed name** merge into one group. The first channel is the leader and controls the group's color and visibility. This is identical to [AOI grouping](/docs/setup/aoi-library/#grouping-aois).

## Creating interval channels

**Create intervals…** derives new interval channels from existing event markers — for example, pairing start/end markers into visibility intervals. The original imported events are never modified; interval channels are added alongside them.

## Applying changes

Click **Apply** to save, or **Cancel** to discard. Unlike the AOI Library, the Event Library applies only to the selected stimulus — there is no cross-stimulus propagation.
