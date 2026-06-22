# Workspace Export

Workspace Export saves your whole session — data, layout, plot settings, and library customizations — as a single JSON file. Re-import it to restore the session exactly, or share it with a colleague.

It is the recommended way to save your work, since the workspace is not saved automatically.

## What it includes

- The full dataset (parsed gaze segments, AOIs, events).
- Grid layout: each plot's position and size.
- Every plot's settings (group, stimulus, metric, axis bounds, colors, view modes).
- Library customizations: [participant groups](/docs/setup/participant-groups/), [AOI names and colors](/docs/setup/aoi-library/), [participant names](/docs/setup/participant-library/), and [stimulus names](/docs/setup/stimuli-library/).

Because the data is embedded, file size scales with your dataset.

## Exporting

1. Click **Export** in the workspace top bar.
2. In the **Export Workspace** section, enter a **File name**.
3. Click **Export Workspace** to download the `.json` file.

## Importing

1. Click **Import** in the workspace top bar.
2. Select a workspace `.json` file. A single `.json` file is always loaded as a workspace.

Importing replaces the current workspace with the saved plots, settings, and layout.
