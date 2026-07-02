# Export

GazePlotter provides six export options for different eye-tracking analysis use cases. Access them through the **Export** button in the workspace top bar.

## Export Types

### [Workspace Export](/docs/export/workspace/) (Primary)

Export your complete workspace configuration as a JSON file. This is the **preferred export method** for saving and sharing GazePlotter work. Preserves all visualization settings, layouts, and customizations for later import.

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

## Export Access

1. Click **Export** in the workspace top bar.
2. Use the **Export Workspace** section, or pick a card under **Other options**.
3. Configure the options and download the file.
