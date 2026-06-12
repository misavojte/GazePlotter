# Segmented Data Export

The Segmented Data Export pipeline serializes raw eye-tracking vectors into structured CSV files meticulously formatted for advanced manipulation in spreadsheet software (Excel, Google Sheets) or command-line scripting architectures (Python, R).

## Data Structure

Segmented CSV file outputs contain highly granular, row-level sequential eye-tracking logic exposing:

- Unified participant identifiers.
- Stimulus metadata connections.
- Raw fixation coordinates (X, Y) and localized duration metrics.
- Segment spatial coordinates (when available from source data).
- Hardcoded AOI collision assignments.
- Absolute micro-second timestamp delineations.
- Computed gaze event classifications.

## Export Configuration

To generate segmented CSV files, you can configure several parameters to filter and format the output.

### Global Settings

- **Export Type**: Choose between **Single CSV File** (monolithic) or **Individual CSV Files (Zipped)** (sharded by participant).
- **File name**: Specify the root output filename.
- **Delimiter**: Choose between **Comma (,)** or **Semicolon (;)**.
- **Decimal Separator**: Choose between **Dot (.)** or **Comma (,)**.

### Data Filtering

- **Stimuli**: Select one or more specific stimuli to include in the export.
- **Fixations Only**: Enable this filter to exclude saccades, blinks, and other non-fixation gaze movements from the output.

## Execution Workflow

1. **Access Export**: Click the **Export workspace or data** button in the [Workspace Toolbar](/docs/setup/workspace/#workspace-toolbar).
2. **Select Format**: In the **Research Data Formats** section, click on the **Segmented Data (CSV)** card.
3. **Configure Settings**: Select your preferred **Export Type**, **File name**, **Delimiter**, and **Decimal Separator**.
4. **Target Data**: Select the target **Stimuli** and apply any **Filters** (e.g., Export only fixations).
5. **Download**: Click the **Export Data** button. A success toast will confirm the file generation.

## Analytical Use Cases

- **Single CSV**: Best for programmatic ingestion (R, Python `pandas`) where algorithmic filtering of monolithic dataframes is required.
- **Zipped Individual CSVs**: Optimal for manual spreadsheet analysis or when research protocols require isolation of subject data arrays.
