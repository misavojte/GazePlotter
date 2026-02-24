---
title: Aggregated data export
order: 4
---

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

- **Selection**: Check the boxes adjacent to the desired stimuli.
- **Aggregation Logic**: Selecting multiple stimuli combines all resulting permutation data into the exact same CSV. Each individual stimulus interaction resolves into its own discrete rows.

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
- **Participant_Name**: The semantically defined [Participant Display Name](/docs/basic/participants-customization/).
- **Stimulus**: The semantically defined [Stimulus Display Name](/docs/basic/stimuli-customization/).
- **AOI_Group**: The assigned [AOI Display Name](/docs/basic/aoi-customization/), or one of the internal system variables.
- **Metric**: The string literal representing the specific metric type (e.g., `"Dwell_Time"`).
- **Value**: The final integer or floating-point mathematical calculation.

### Internal System Variables

Within the `AOI_Group` column, the exporter may utilize reserved variables:

- **`No_AOI`**: Represents the mathematical aggregation of all fixations that occurred completely outside any manually defined AOI polygons.
- **`Any_Fixation`**: Represents the brute total aggregation calculation across absolutely all recorded fixations for that stimulus iteration.

### Structure Example

```csv
Participant_ID,Participant_Name,Stimulus,AOI_Group,Metric,Value
1,"P01","Image1","Logo","Dwell_Time",1250.5
1,"P01","Image1","Logo","Fixation_Count",3
1,"P01","Image1","No_AOI","Dwell_Time",450.2
```

## Execution Workflow

1. Configure the primary export variables (Filename, Target Group).
2. Manually select the target Stimuli.
3. Manually select the specific statistical Metrics to be calculated.
4. Click the **Export CSV** execution button.
5. The system computes the matrix and serves the CSV. A momentary success banner will display the exact row count of the generated `.csv` matrix.

## System Integration Note

::: tip External Tool Optimization
The explicit long format utilized by this export routine was designed from the ground up for data frame ingestion.

- **R**: Native compatibility via `read.csv()` coupled natively with `tidyverse` restructuring logic.
- **Python**: 1:1 mapped importation into `pandas` dataframes for immediate statistical modeling.
- **SPSS**: Immediate direct matrix importation for structural ANOVA processing and regression analysis.
  :::
