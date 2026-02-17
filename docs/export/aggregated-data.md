---
title: Aggregated data export
order: 4
---

# Aggregated Data Export

Export statistical metrics (dwell time, fixation counts, durations) in long format CSV for analysis in R, Python, or SPSS.

## Purpose

Aggregated data export provides:

- Statistical metrics for each participant-stimulus-AOI combination
- Long format CSV structure optimized for statistical analysis
- Multiple metrics in a single export
- Compatibility with data analysis software

## Export Configuration

### File Settings

- **File name** - specify output CSV filename (without extension)
- **Participant Group** - select which participant group to include in export

### Stimulus Selection

Choose one or multiple stimuli to include:

- Select from available stimuli using checkboxes
- Multiple stimuli will be combined in single CSV
- Each stimulus contributes separate rows to the dataset

### Metrics Selection

Choose from following eye-tracking metrics:

#### Absolute Dwell Time

Total time spent in each AOI (ms) across all fixations.

#### Relative Dwell Time (%)

Dwell time as percentage of total viewing time for each AOI.

#### Time to First Fixation

Time until first fixation on each AOI (from stimulus start). Returns -1 if AOI was never fixated.

#### First Fixation Duration

Duration of the first fixation on each AOI. Returns -1 if AOI was never fixated.

#### Fixation Count

Number of fixations on each AOI.

#### Mean Fixation Duration

Average duration of fixations on each AOI. Returns -1 if AOI was never fixated.

#### Visit Count

Number of distinct visits to each AOI (consecutive fixations count as one visit).

#### Mean Visit Duration

Average duration of visits to each AOI. Returns -1 if AOI was never visited.

## CSV Format

### Structure

Long format CSV with columns:

- **Participant_ID** - numeric participant identifier
- **Participant_Name** - displayed participant name
- **Stimulus** - stimulus name
- **AOI_Group** - AOI name or special group
- **Metric** - metric type (e.g., "Dwell_Time")
- **Value** - calculated metric value

### Special AOI Groups

- **No_AOI** - fixations outside any defined AOI
- **Any_Fixation** - aggregated values across all fixations

### Example Data

```
Participant_ID,Participant_Name,Stimulus,AOI_Group,Metric,Value
1,"P01","Image1","Logo","Dwell_Time",1250.5
1,"P01","Image1","Logo","Fixation_Count",3
1,"P01","Image1","No_AOI","Dwell_Time",450.2
```

## Export Process

1. Configure export settings (filename, group)
2. Select stimuli to include
3. Choose metrics to calculate
4. Click **Export CSV** to download file
5. Success message shows exported data points count

## Statistical Analysis Usage

This format is optimized for:

- **R** - use `read.csv()` and reshape/analyze with tidyverse
- **Python** - import with pandas for statistical modeling
- **SPSS** - direct import for ANOVA and regression analysis
- **Custom scripts** - standard CSV format for any analysis tool

::: tip Analysis Tip
The long format structure makes it easy to perform grouped analyses, create visualizations, and run mixed-effects models with participant and stimulus as factors.
:::
