---
title: Event Customization
order: 9
---

# Event Customization

Event Customization in GazePlotter provides control over event channel names, colors, ordering, grouping, and visibility. Each stimulus has its own independent set of event channels.

For information on uploading event data, see [Event Data](/docs/upload-data/events/).

## Accessing the Tool

1. Click the **More options** button (⋮) in the top right corner of any scarf plot.
2. Select **Event customization** from the menu.

## Stimulus Selection

Event channels are bound to specific stimuli. Select the target stimulus from the **For stimulus** dropdown before making modifications.

## Modifying Event Channels

Every event channel within the selected stimulus is listed in a table with the following columns.

### Renaming

- **Action**: Modify the **Displayed name** text field.
- **Behavior**: Overrides the visual label of the event channel in all legends and plots, while preserving the original source name.

### Recoloring

- **Action**: Click the color picker in the **Color** column.
- **Behavior**: Overrides the default color of the event channel line.
- _Constraint_: This option is only available for individual ungrouped channels or designated group leaders (see Grouping section below).

### Reordering

- **Action**: Click the up and down arrows in the **Order** column.
- **Behavior**: Alters the rendering order of the event channel. This dictates the sequence in legends and in the stacked event lines beneath the scarf plot rows.

### Hiding and Showing

- **Action**: Toggle the checkbox in the **Is active** column.
- **Behavior**: Hidden channels are excluded from the scarf plot rendering. They remain in the data and can be re-activated at any time.

### Bulk Sorting

Use the column header controls to sort:

- **Name** — Sorts alphanumerically by original channel name.
- **Displayed name** — Sorts alphanumerically by the customized displayed name.

Clicking the same header toggles between ascending and descending order. The algorithm uses natural ordering (e.g., Channel 2 precedes Channel 10).

## Event Channel Grouping

GazePlotter implements automatic grouping based on name matching, identical to the [AOI grouping system](/docs/basic/aoi-customization/#aoi-grouping-system).

### How Grouping Works

Event channels that share an identical **Displayed name** are automatically aggregated into a single group in all visualizations.

- **Color inheritance**: The first listed channel in a group acts as the leader. The leader's color propagates to all group members.
- **UI behavior**: Only the leader channel exposes color and order controls.

### Managing Groups

- **Creating a group**: Give two or more channels the exact same text in their **Displayed name** field.
- **Detaching from a group**: Change a channel's **Displayed name** to a unique value.

## Applying Changes

Click **Apply** to commit modifications. Changes are applied exclusively to the currently selected stimulus.

> **Note**: Unlike AOI customization, event customization does not support cross-stimulus propagation. Each stimulus must be modified independently.
