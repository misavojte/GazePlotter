---
title: AOI customization
order: 8
---

# AOI Customization

AOI Customization in GazePlotter acts as a centralized tool to modify the visual aesthetics, names, and processing order of Areas of Interest (AOIs). Use this module to construct AOI groups, map custom color palettes, and seamlessly propagate naming conventions across multiple target stimuli.

## Accessing the Tool

To customize your underlying AOIs:

1. Click the **More options** button positioned in the top right corner of any visible plot.
2. Select **AOI customization** from the contextual pop-up menu.

## Core Setup

### Stimulus Selection

AOIs are inherently bound to specific stimuli. Before making modifications, you must declare your operational context.

- **Action**: Open the **For stimulus** dropdown menu.
- **Behavior**: Determines which specific stimulus data structure you are currently editing.

_Note: Changes made here can later be applied selectively to just this stimulus or broadcast globally across all stimuli in the dataset._

## Modifying AOIs

Every AOI within the declared stimulus is listed individually.

### Individual Operations

#### Renaming

- **Action**: Modify the **Displayed name** text field.
- **Behavior**: Overrides the visual name of the AOI in all legends and plots, while securely preserving the original source name in the dataset.

#### Recoloring

- **Action**: Click the color picker in the **Color** column.
- **Behavior**: Overrides the default color mapping.
- _Constraint_: This option is only available for individual ungrouped AOIs or designated group leaders (see Grouping section below).

#### Reordering

- **Action**: Click the up and down arrows in the **Order** column.
- **Behavior**: Alters the rendering index of the AOI. This dictates their sequence in legends and stacked visualizations.

### Bulk Sorting Actions

To quickly organize large numbers of AOIs, utilize the column header controls:

- **Original Name**: Sorts the list alphanumerically based on the raw AOI names imported from the source data.
- **Displayed Name**: Sorts the list alphanumerically based on the currently customized displayed names.

_Clicking the same header multiple times toggles between ascending and descending sort directions. The algorithm uses natural ordering logic (e.g., AOI-2 correctly precedes AOI-10)._

## AOI Grouping System

GazePlotter implements an automatic, semantic grouping architecture based entirely on nomenclature matching.

### How Grouping Works

Any AOIs that share an identical **Displayed Name** are automatically aggregated and treated as a singular, unified group entity in all downstream visualizations.

- **Color Inheritance**: The first listed AOI in any group acts as the leader. The leader's configured color propagates strictly to all other group members automatically.
- **UI Behavior**: To prevent conflicts, only the leader AOI exposes color and order modification controls within the interface.

### Group Management

- **Creating a group**: Give two or more independent AOIs the exact same text string in their **Displayed name** field.
- **Detaching from a group**: Alter a specific AOI's **Displayed name** to be uniquely distinct from the rest of the group.

::: tip Semantic Grouping Example
If your study features multiple discrete targets that all represent the same conceptual element (e.g., "Target 1", "Target 2", "Target 3"), simply rename all of their Displayed Names to "Target". They will instantly fuse into a single "Target" group with a unified color in all plots.
:::

## Committing Changes

When finished modifying properties, you must select the scope of your update.

### Application Scopes

Choose how broadly to apply your targeted modifications across the dataset:

- **This stimulus**: Commits modifications exclusively to the single stimulus selected in the dropdown.
- **All by original name**: Broadcasts the modifications to every stimulus in the dataset that contains AOIs matching the **Original Names** you edited.
- **All by displayed name**: Broadcasts the modifications to every stimulus in the dataset that contains AOIs matching the **Displayed Names** you edited.

::: info Ordering Constraint
When applying changes globally to all stimuli, understand that **AOI ordering adjustments** are strictly sandboxed to the currently selected active stimulus. Order does not broadcast.
:::

### Finalizing

- **Save**: Click the **Apply** button to execute the changes using the specified scope. Closing the window before clicking Apply immediately discards your session.

![](/docs/images/1.png)
