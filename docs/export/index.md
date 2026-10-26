# Export

GazePlotter provides seven export options for different eye-tracking analysis use cases. Access them through the **Export** button in the header.

## Export Types

### [Workspace Export](/docs/export/workspace/) (Primary)

Save your complete workspace as one `.gazeplotter` file with **Ctrl+S** (**⌘S** on macOS). This is the **preferred way** to save and share GazePlotter work: it keeps the data, all visualization settings, layouts, customizations, and reference media.

### [Figure Export](/docs/export/figures/)

Render all or selected workspace plots as PNG or JPG images at a chosen resolution, with a live preview. A single figure downloads directly; several bundle into one ZIP archive. Regenerates a complete figure set in one pass.

### [Segmented Data Export](/docs/export/segmented-data/)

Export processed eye-tracking data as CSV files. Available as single file or individual files per participant.

### [Event Data Export](/docs/export/event-data/)

Export event occurrences with their timing per participant and stimulus. Available when the loaded dataset contains event data; single-file exports can be re-imported as event files.

### [Metric Data Export](/docs/export/metric-data/)

Export statistical eye-tracking metrics in long (tidy) or wide CSV formats for analysis in R, Python, SPSS, JASP, or jamovi. Includes participant-pair metrics such as scanpath similarity, exported as pair rows (long) or a similarity matrix (wide).

### [ScanGraph Export](/docs/export/scangraph/)

Export fixation sequences for scanpath analysis in the ScanGraph tool. Converts gaze data to letter-coded sequences.

### [Analysis Export](/docs/advanced/headless/#the-analysis)

Export the workspace's Analysis as JSON: the renames, merges, selections, and metric definitions, by name. The [command line](/docs/advanced/headless/) replays it on other recordings of the same study.

## Export Access

1. Click **Export** in the header.
2. Save from the **Workspace** section, or pick a card under **Figures and data**.
3. Configure the options and download the file.
