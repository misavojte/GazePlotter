---
title: Segmented Data workflows
order: 4
outline: deep
---

# Segmented Data Workflows (Export → Edit → Re-upload)

The Segmented Duration CSV format natively supports bi-directional round-trip pipelines: you can export raw segmented vectors, mechanically edit them inside a spreadsheet or programmatic text editor, and seamlessly re-ingest them back into GazePlotter.

This enables you to perform highly precise data manipulations, such as cropping irrelevant early segments, splitting specific stimuli into discrete subsets, and normalizing time baselines mathematically.

## Standardized Format Requirements

Any CSV file interacting with this system must strictly adhere to the [Segmented Duration CSV structure](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv).

### Required Data Schema

- **`timestamp`**: Start time vector of the individual segment.
- **`duration`**: Absolute duration calculation of the individual segment.
- **`eyemovementtype`**: Binary eye movement classifier (0 = Fixation, 1 = Saccade).
- **`participant`**: Exact textual participant name assignment.
- **`stimulus`**: Exact textual stimulus name assignment.
- **`AOI`**: Exact textual AOI name collision (can securely remain empty).

### Hard Editing Constraints

- **Preserve Sequential Sorting**: All row data must remain strictly in correct chronological order within every specific Participant × Stimulus combination block.
- **Prevent Manual Timestamp Adjustment**: Do not attempt to manually recalculate or shift timestamps. The GazePlotter import engine automatically re-normalizes them upon ingestion.
- **Enforce Required Fields**: The `participant` and `stimulus` cells must always contain string values.

## Workflow 1: Cropping Initialization Sequences

Mobile eye-tracking data often contains extensive initial setup phases, calibrations, or operator instructions. This workflow strips out this irrelevant early data while resolving the temporal baselines.

### Execution Routine

1. **Extraction**: Command GazePlotter to output the dataset as a [Segmented Data CSV](/docs/export/segmented-data/).
2. **Editing Environment**: Open the exported `.csv` document inside Excel, Google Sheets, or a dedicated text editor.
3. **Filtering**: Filter the view strictly to the specific Participant and Stimulus combination requiring truncation.
4. **Deletion**: Manually highlight and permanently delete the specific rows (segments/fixations) that constitute the initialization period you wish to crop.
5. **Serialization**: Save the active file cleanly as a standard comma-delimited `.csv`.
6. **Re-ingestion**: Navigate back to GazePlotter and execute an upload via the [Segmented Duration CSV](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv) schema.

**System Behavior Result**: The import engine reads the modified file and mechanically re-normalizes the timestamps. The _first remaining segment_ of that specific Participant × Stimulus block is automatically rewritten as the new absolute `0` start time baseline.

![](/docs/images/segmented-data-workflow_1.jpg)
![](/docs/images/segmented-data-workflow_2.jpg)

## Workflow 2: Segmenting Monolithic Stimuli

Lengthy, continuous recordings often encompass multiple independent analytical phases. This workflow explicitly shatters a single long recording into discrete, isolated stimuli strings.

### Execution Routine

1. **Extraction**: Output the root dataset via the standard [Segmented Data CSV algorithm](/docs/export/segmented-data/).
2. **Identification**: Within the open CSV, locate the precise timestamps where your participants seamlessly transition between distinct task phases or physical environments.
3. **Semantic Renaming**: Modify the string values in the `stimulus` column from the original monolithic name to new, highly semantic phase names (e.g., change `Shopping_Task` to `Shopping_Selection`, `Shopping_Checkout`, `Shopping_Review`) corresponding to their specific timestamps.
4. **Serialization**: Save the structurally modified spreadsheet as a standard `.csv`.
5. **Re-ingestion**: Upload the newly mapped dataset utilizing the [Segmented Duration CSV module](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv).

**System Behavior Result**: GazePlotter processes the newly injected stimulus names as totally independent structures. Critically, each newly defined task phase is automatically assigned its own mathematical start baseline (time `0`), effectively isolating them into clean discrete analytical blocks.

![](/docs/images/segmented-data-workflow_3.jpg)
![](/docs/images/segmented-data-workflow_4.jpg)
