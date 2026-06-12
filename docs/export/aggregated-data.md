# Aggregated Data Export

The Aggregated Data Export pipeline condenses raw eye-tracking vectors into a highly structural, mathematically rigorous long-format CSV. This output is explicitly designed for seamless ingestion into advanced statistical processing engines (R, Python, SPSS).

## Analytical Purpose

Generating aggregated data files provides:

- Explicit statistical metrics calculated individually for each unique Participant-Stimulus-AOI interaction.
- A standardized long-format CSV architecture optimized for programmatic parsing.
- Highly parallelized metric outputs consolidated into a singular unified export matrix.

## Export Configuration

To generate the analytical export, several systemic parameters must be defined.

### Global File Settings

- **File name**: Specify the root output filename (the `.csv` extension is appended automatically).
- **Participant Group**: Select which specific logical participant group cohort should be actively iterated during the export generation.

### Stimulus Targeting

Designate exactly which stimuli from the core dataset contribute rows to the CSV output.

- **Stimuli Selection**: Check the boxes adjacent to the desired stimuli in the **Stimuli** column. Selecting multiple stimuli combines all resulting permutation data into the same CSV.
- **Delimiter**: Choose between **Comma (,)** or **Semicolon (;)** to define the column separation character.
- **Decimal Separator**: Choose between **Dot (.)** or **Comma (,)** for numeric floating-point values.
- **Aggregation Logic**: Each individual stimulus interaction resolves into its own discrete rows within the unified matrix.

## Metrics Selection

You must deliberately select which specific mathematical operations the system executes.

### Duration Metrics

- **Absolute Dwell Time**: Total aggregate time logically spent located within the AOI, calculated in milliseconds (ms).
- **Relative Dwell Time (%)**: Dwell time geometrically expressed as a direct percentage of the total active viewing duration.
- **Time to First Fixation**: Total temporal delay from the initiation of the stimulus until the first recorded fixation collides with the AOI. _(Outputs `-1` if the AOI is never achieved)._
- **First Fixation Duration**: Absolute duration of the inaugural fixation impacting the AOI. _(Outputs `-1` if the AOI is never achieved)._
- **Mean Fixation Duration**: The standard average duration of all independent fixations registered on the AOI. _(Outputs `-1` if the AOI is never achieved)._
- **Mean Visit Duration**: The standard average duration of all distinct logical visits to the AOI. _(Outputs `-1` if the AOI is never achieved)._

### Frequency Metrics

- **Fixation Count**: The absolute integer quantity of discrete fixations registered on the AOI.
- **Visit Count**: The absolute integer quantity of grouped continuous visits. _(Consecutive, unbroken serial fixations inside the exact same AOI count dynamically as 1 unified visit)._

## Data Architecture

Understanding the physical structure of the resulting CSV is crucial for programmatic parsing scripts.

### CSV Structure (Long Format)

The system automatically outputs a strict long-format structure comprising these specific column headers:

- **Participant_ID**: The numeric tracking identifier of the participant.
- **Participant_Name**: The semantically defined [Participant Library](/docs/setup/participant-library/).
- **Stimulus**: The semantically defined [Stimuli Library](/docs/setup/stimuli-library/).
- **AOI_Group**: The assigned [AOI Library](/docs/setup/aoi-library/), or one of the internal system variables.
- **Metric**: The string literal representing the specific metric type (e.g., `"Dwell_Time"`).
- **Value**: The final integer or floating-point mathematical calculation.

### Internal System Variables

Within the `AOI_Group` column, the exporter may utilize reserved variables:

- **`No_AOI`**: Represents the mathematical aggregation of all fixations that occurred completely outside any manually defined AOI polygons.
- **`Any_Fixation`**: Represents the brute total aggregation calculation across absolutely all recorded fixations for that stimulus iteration.

### Structure Example

```csv
Participant_ID,Participant_Name,Stimulus,AOI_Group,Metric,Value
1,"P01","Image1","Logo","Absolute_Dwell_Time",1250.5
1,"P01","Image1","Logo","Fixation_Count",3
1,"P01","Image1","No_AOI","Absolute_Dwell_Time",450.2
```

## Execution Workflow

1. **Access Export**: Click the **Export workspace or data** button in the [Workspace Toolbar](/docs/setup/workspace/#workspace-toolbar).
2. **Select Format**: In the **Research Data Formats** section, click on the **Aggregated Data (CSV)** card.
3. **Configure Settings**: Define the **File name**, target **Participant Group**, and preferred **Delimiter** and **Decimal Separator**.
4. **Target Data**: Manually select the target **Stimuli** and target statistical **Metrics** to be calculated.
5. **Download**: Click the **Export CSV** execution button. The system computes the matrix and serves the CSV. A success toast will display the exact data points and metrics count.

> **External Tool Optimization**: The explicit long format utilized by this export routine was designed from the ground up for data frame ingestion.
>
> - **R**: Native compatibility via `read.csv()` coupled natively with `tidyverse` restructuring logic.
> - **Python**: 1:1 mapped importation into `pandas` dataframes for immediate statistical modeling.
> - **SPSS**: Immediate direct matrix importation for structural ANOVA processing and regression analysis.
