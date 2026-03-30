# Participant Grouping

Participant grouping in GazePlotter allows you to logically organize participants into distinct groups for rigorous comparative eye-tracking analysis. The grouping interface offers comprehensive management capabilities, including targeted search filtering, bulk participant assignment, and session change tracking.

## Accessing the Tool

To create or modify your participant groupings:

1. Click the **More options** button positioned in the top right corner of any visible plot.
2. Select **Setup participant grouping** from the contextual pop-up menu.

Executing this action opens the centralized participant grouping modal window.

## Group Management

### Creating Groups

#### Adding a new group

- **Action**: Click the **Add group** button located at the bottom of the modal.
- **Behavior**: Instantiates a new underlying grouping entity. It is automatically assigned a sequential default name (e.g., "Group 1") and appended to your active list.

### Modifying Groups

Every created group renders as an individual, expandable accordion item in the interface.

#### Renaming

- **Action**: Click directly on the group name text field.
- **Behavior**: Allows you to type a new customized, descriptive name for your analysis group.

#### Reordering

- **Action**: Click the up and down arrows on the group header.
- **Behavior**: Adjusts the index order of the group within the list.
- **Impact**: This specific ordering directly dictates the sequence in which groups are rendered in final plots.

#### Deletion

- **Action**: Click the trash bin icon.
- **Behavior**: Permanently destroys the group entity and dissociates all assigned participants.

## Assigning Participants

Clicking the header layer of any group expands it to reveal direct participant assignment options.

### Individual Assignment

The expanded view populates a comprehensive list of all participants present in your current dataset.

- **Add**: Check the box adjacent to a target participant's name to link them to the group.
- **Remove**: Uncheck the box to break the link and remove them.

### Bulk Operations

You can leverage bulk operations to efficiently assign or unassign entire cohorts of participants simultaneously.

#### Select Visible

- **Action**: Click the **Select visible** button.
- **Behavior**: Links all participants currently rendered in the list to the selected group.

#### Deselect Visible

- **Action**: Click the **Deselect visible** button.
- **Behavior**: Dissociates all currently rendered participants from the selected group.

### Search Filtering

When working with substantial participant counts, utilize the **Search participants** field to narrow down the visible list.

- **Filtering**: The search engine filters participants continuously based on their current displayed name.
- **Visibility**: When a search filter is actively applied, only matching participant names are rendered in the list.
- **Analytics**: A dynamic summary text below the active list calculates exactly how many participants are currently hidden by your search parameters.

> **Utilizing Search for Bulk Operations**: The search filter and bulk operations are explicitly designed to be used in tandem. If your goal is to group all participants possessing "Control" in their displayed name:
>
> 1. Search for the exact string "Control".
> 2. Click **Select visible** to bind them all instantly.
> 3. If you subsequently clear the search field, those "Control" participants remain firmly assigned to the group while you search for completely different cohorts.

## Session State Tracking

As you execute changes within the modal, GazePlotter's engine continuously tracks whether your current state differs from the initial load state.

### Saving Modifications

- **Action**: Click the **Save** button.
- **Behavior**: Commits and applies all grouping modifications system-wide across your workspace.
- **Validation**: The Save button is only active when uncommitted changes exist.

### Discarding Modifications

- **Action**: Click the **Discard Changes** button.
- **Behavior**: Immediately reverts all participant groups back to their exact state prior to opening the modal window. All unsaved interactions are discarded.
