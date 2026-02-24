---
title: Workspace export
order: 2
---

# Workspace Export

Workspace Export serialization allows you to download your entire active GazePlotter session as a lightweight JSON file. This format preserves all visualization layouts, granular plot settings, and semantic global customizations exactly as they appear in your browser.

## Strategic Use Cases

Exporting the entire workspace state enables advanced analytical continuity:

- **Incremental Backup**: Save daily workspace checkpoints to prevent accidental analytical loss.
- **Collaborative Sharing**: Distribute complete, ready-to-view dashboards to colleagues.
- **Environment Transfer**: Seamlessly move specific active analysis sessions between different laboratory devices.
- **Standardized Templates**: Construct reusable grid configurations and color palettes for rigorous multi-study standard operating procedures.

## State Preservation Scope

A workspace JSON export comprehensively captures:

### Global Architecture

- The absolute positioning and sizing dimensions of all instantiated plot cards.
- Core global filtering states applied to the root dataset.

### Granular Configurations

- **Visualization State**: The specific configurations active within every single plot (e.g., active grouping, exact zoom bounds, rendering modes).
- **Setup State**: Every semantic adjustment created in [Participant groupings](/docs/basic/groups/), [AOI customizations](/docs/basic/aoi-customization/), [Participant modifications](/docs/basic/participants-customization/), and [Stimuli modifications](/docs/basic/stimuli-customization/).

## Execution Workflows

### Exporting the Workspace

To serialize and download your current setup:

1. **Locate Tool**: Open the main **Export Format** configuration section.
2. **Format Selection**: Ensure the active format is explicitly set to **GazePlotter**.
3. **Naming**: Input a descriptive file identifier into the **Export Options** text field.
4. **Execution**: Click the primary **Download** button to serialize and save the `.json` file to your local machine.

### Importing a Workspace

To restore a previously saved analytical state:

1. **Locate Tool**: Click the **Upload data** action button situated in the persistent left [Workspace Toolbar](/docs/basic/workspace/).
2. **File Selection**: Navigate your local file system and select the targeted workspace `.json` file.
3. **Execution**: The system will automatically overwrite the active interface, immediately loading all original plots, configurations, and spatial grid arrangements verbatim.

::: tip File Footprint
Workspace state files contain only logic and parameters, not raw gaze vectors. They result in extraordinarily small JSON files (often mere kilobytes), making them perfect for email distribution or strict version control system tracking.
:::
