# Segmented Data Workflows (Export → Edit → Re-upload)

The [Segmented Duration CSV](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv) format round-trips: export your data, edit it in a spreadsheet or text editor, and re-upload it. This lets you crop unwanted segments or split one recording into several stimuli.

## Rules

Any file you re-upload must use the [Segmented Duration CSV](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv) columns: `stimulus`, `participant`, `timestamp`, `duration`, `eyemovementtype`, `AOI` (the `AOI` cell may be empty).

- Keep rows in chronological order within each Participant × Stimulus block.
- Don't recompute timestamps — GazePlotter renormalizes them on import. The first remaining segment of each Participant × Stimulus is reset to time `0`.
- `participant` and `stimulus` must always have a value.

## Workflow 1: Crop the start of a recording

Mobile recordings often begin with calibration or instructions. Remove them:

1. [Export segmented data](/docs/export/segmented-data/) as CSV.
2. Open it in a spreadsheet or text editor.
3. For the Participant × Stimulus you want to trim, delete the early rows.
4. Save as CSV and re-upload.

On import, the first remaining segment becomes the new `0` baseline.

![Segmented Data CSV before removing initialization rows.](/docs/images/segmented-data-workflow_1.jpg)
![Segmented Data CSV after removing initialization rows.](/docs/images/segmented-data-workflow_2.jpg)

## Workflow 2: Split one recording into several stimuli

To break a long recording into separate phases:

1. [Export segmented data](/docs/export/segmented-data/) as CSV.
2. Find the timestamps where phases change.
3. Rename the `stimulus` value per phase (e.g. `Shopping_Task` → `Shopping_Selection`, `Shopping_Checkout`, `Shopping_Review`).
4. Save as CSV and re-upload.

Each distinct stimulus name becomes an independent stimulus with its own `0` baseline.

![Segmented Data CSV before splitting one stimulus into multiple phases.](/docs/images/segmented-data-workflow_3.jpg)
![Segmented Data CSV after renaming stimulus values into separate phases.](/docs/images/segmented-data-workflow_4.jpg)
