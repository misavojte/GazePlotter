---
title: Custom CSV
order: 8
---

# Upload of Custom CSV Files

In addition to the supported file types, GazePlotter supports three different CSV formats for uploading custom eye-tracking data. Each format is designed for different data structures and use cases.

## Overview of CSV Formats

GazePlotter supports three CSV formats:

1. **[Continuous Time Series](#continuous-time-series-csv)** - Raw gaze data with timestamps
2. **[Segmented From/To](#segmented-fromto-csv)** - Pre-segmented data with start/end times
3. **[Segmented Duration](#segmented-duration-csv)** - Segmented data with timestamp and duration

## Continuous Time Series CSV

This format is used for raw gaze data where each row represents a single gaze sample with a timestamp.

### Required Columns

The CSV file must contain the following columns on the first line:

- `Time` - timestamp of the sample, simple number, no units or commas allowed
- `Participant` - text string of the participant name to be displayed
- `Stimulus` - text string of the stimulus name to be displayed
- `AOI` - text string of the AOI name to be displayed

### Delimiters

- `,` - column delimiter
- `\n`, `\r\n`, or `\r` - row delimiter (automatically detected)

### Formatting

Each row represents one gaze sample. Segments are automatically determined by the homogeneity of the `AOI`, `Participant`, and `Stimulus` columns.

::: info
Segments are automatically detected based on changes in `AOI`, `Participant`, or `Stimulus` values.
:::

### Example

```csv
Time,Participant,Stimulus,AOI
0,Participant 1,Stimulus 1,AOI 1
25,Participant 1,Stimulus 1,AOI 1
50,Participant 1,Stimulus 1,AOI 1
75,Participant 1,Stimulus 1,AOI 1
100,Participant 1,Stimulus 1,AOI 1
100,Participant 1,Stimulus 1,AOI 2
125,Participant 1,Stimulus 1,AOI 2
```

## Segmented From/To CSV

This format is used for pre-segmented data where each row represents a complete segment with explicit start and end times.

### Required Columns

The CSV file must contain the following columns on the first line:

- `From` - start time of the segment, simple number
- `To` - end time of the segment, simple number
- `Participant` - text string of the participant name
- `Stimulus` - text string of the stimulus name
- `AOI` - text string of the AOI name

### Delimiters

- `,` - column delimiter
- `\n`, `\r\n`, or `\r` - row delimiter (automatically detected)

### Formatting

Each row represents one complete segment. The `From` and `To` columns define the segment duration.

::: info
Each row is treated as a complete segment with the specified start and end times.
:::

### Example

```csv
From,To,Participant,Stimulus,AOI
0,100,Participant 1,Stimulus 1,AOI 1
100,125,Participant 1,Stimulus 1,AOI 2
200,300,Participant 1,Stimulus 2,AOI 1
```

## Segmented Duration CSV

This format is used for segmented data where each row contains a timestamp and duration, with automatic time normalization.

### Required Columns

The CSV file must contain the following columns on the first line:

- `timestamp` - start time of the segment, simple number
- `duration` - duration of the segment, simple number
- `eyemovementtype` - eye movement type (0 = Fixation, 1 = Saccade)
- `participant` - text string of the participant name
- `stimulus` - text string of the stimulus name
- `AOI` - text string of the AOI name

### Delimiters

- `,` - column delimiter
- `\n`, `\r\n`, or `\r` - row delimiter (automatically detected)

### Formatting

Each row represents one segment. The system automatically normalizes timestamps so that each participant/stimulus combination starts from time 0.

::: info
Timestamps are automatically normalized - the first segment for each participant/stimulus combination becomes the baseline (time 0).
:::

::: info
Eye movement types: `0` = Fixation, `1` = Saccade
:::

::: tip Advanced workflows
The Segmented Duration format enables powerful data editing workflows. Export your data as [Segmented Data CSV](/docs/export/segmented-data/), edit it in Excel or a text editor (crop segments, split stimuli), then re-upload using this format. See [Segmented Data workflows](/docs/advanced/segmented-data-workflows/) for detailed examples.
:::

### Example

```csv
stimulus,participant,timestamp,duration,eyemovementtype,AOI
SMI Base,Anna,226.2,72,1,
SMI Base,Anna,298.2,120,0,Map
SMI Base,Anna,418.2,28,1,
SMI Base,Anna,446.2,208,0,Map
SMI Base,Anna,654.2,36,1,
```
