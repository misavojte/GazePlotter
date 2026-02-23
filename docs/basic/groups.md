---
title: Participant grouping
order: 7
---

# Participant grouping

Participant grouping in GazePlotter allows you to organize participants into custom groups for comparative eye-tracking analysis. The interface provides advanced group management with search filtering, bulk operations, and change tracking for efficient data organization.

## Accessing participant grouping

To manage participant groups:

1. Click on the `More options` button in the top right corner of any plot.
2. Select `Setup participant grouping` from the pop-up menu.

## Group Management

### Adding Groups

- Click `Add group` to create a new group
- Groups are automatically named "Group 1", "Group 2", etc.
- Each group gets the lowest available ID number

### Group Properties

For each group you can:

- **Edit name** - Click in the group name field to rename
- **View participant count** - Shows "X/Y participants" (selected/total)
- **Reorder groups** - Use up/down arrows to change group order
- **Delete groups** - Click the trash icon to remove a group

### Group Accordion Interface

- Click the participant count button to expand/collapse each group
- Expanded groups show detailed participant management options
- Multiple groups can be expanded simultaneously

## Participant Selection

### Individual Selection

- Each participant has a checkbox within expanded groups
- Check/uncheck to add/remove participants from groups
- Participants can belong to multiple groups simultaneously

### Search Filtering

- Use the "Search participants" field to filter the participant list
- Search is case-insensitive and matches participant names
- Hidden participants counter shows how many are filtered out
- **Important**: Selections persist when search is cleared

### Bulk Operations

Within each group:

- **Select visible** - Adds all currently visible (filtered) participants to the group
- **Deselect visible** - Removes all currently visible participants from the group
- These operations respect the current search filter

## Change Tracking

The interface tracks all modifications:

- **Unsaved changes** are highlighted with enabled Save/Discard buttons
- **Auto-detection** of changes to group names, participants, or order
- **Change persistence** - Modifications are preserved until saved or discarded

### Saving Changes

- **Save** - Applies all changes and updates visualizations
- **Discard Changes** - Reverts to the last saved state
- Both buttons are disabled when no changes are pending

## Tips for Effective Grouping

- **Search before bulk operations** - Filter participants before using "Select visible" for targeted group building
- **Multiple group membership** - Participants can belong to several groups for different analyses
- **Persistent selections** - Use search to verify group membership without losing selections
- **Group ordering** - Arrange groups in logical order for easier navigation in visualizations

![](/docs/images/1.png)
