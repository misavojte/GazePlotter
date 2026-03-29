---
title: Custom CSV
order: 8
---

# Uploading Custom CSV Architectures

GazePlotter natively supports three highly formalized CSV ingestion formats. These structures allow users to manually import custom eye-tracking vectors directly from non-standard hardware or heavily modified post-processing pipelines.

## Ingestion Formats

Before uploading, data must be strictly formatted into one of these three explicit data schema architectures.

### Format 1: Continuous Time Series CSV

This schema ingests raw, continuous gaze coordinate arrays where every individual row represents a single sequential microsecond tick.

#### Structure Requirements

- **Row 1 Headers**: Must contain exactly `Time`, `Participant`, `Stimulus`, and `AOI` (case-sensitive).
- **Time Value**: Absolute numerical integer. Commas and units (e.g., "ms") are strictly prohibited.
- **Participant Value**: Semantic display string.
- **Stimulus Value**: Semantic display string.
- **AOI Value**: Semantic display string. Multiple AOIs can be assigned to a single row by separating them with a pipe character (`|`), e.g., `Header|Menu`.

#### Delimitation Constraints

- **Columns**: Strictly delimited by commas `,`.
- **Rows**: Standard carriage returns `\n`, `\r\n`, or `\r`.

#### Parsing Behavior

Segments are detected dynamically. The engine automatically fractures the continuous time series into discrete segments whenever the string values within the `AOI`, `Participant`, or `Stimulus` columns change homogenously.

```csv
Time,Participant,Stimulus,AOI
0,Participant 1,Stimulus 1,AOI 1
25,Participant 1,Stimulus 1,AOI 1
50,Participant 1,Stimulus 1,AOI 1|AOI 3
75,Participant 1,Stimulus 1,AOI 2
100,Participant 1,Stimulus 1,AOI 2
```

### Format 2: Segmented From/To CSV

This schema ingests pre-processed data algorithms that have already been fractured into discrete segments. Each row defines the exact total duration of a complete segment.

#### Structure Requirements

- **Row 1 Headers**: Must contain exactly `From`, `To`, `Participant`, `Stimulus`, and `AOI`.
- **From Value**: Explicit integer start timestamp.
- **To Value**: Explicit integer end timestamp.
- **Metadata Values**: Standard semantic strings. For the `AOI` column, multiple AOIs can be assigned by separating them with a pipe character (`|`), e.g., `Header|Menu`.

#### Delimitation Constraints

- **Columns**: Strictly delimited by commas `,`.
- **Rows**: Standard carriage returns `\n`, `\r\n`, or `\r`.

#### Parsing Behavior

The parser treats every absolute row as an entirely complete and discrete temporal segment based exclusively on the bounding `From` and `To` values.

```csv
From,To,Participant,Stimulus,AOI
0,100,Participant 1,Stimulus 1,AOI 1
100,125,Participant 1,Stimulus 1,AOI 2|AOI 3
200,300,Participant 1,Stimulus 2,AOI 1
```

### Format 3: Segmented Duration CSV

This specialized schema ingests discrete segments while simultaneously executing algorithmic timestamp normalization protocols on the back-end.

#### Structure Requirements

- **Row 1 Headers**: Must contain exactly `stimulus`, `participant`, `timestamp`, `duration`, `eyemovementtype`, and `AOI`.
- **Timestamp Value**: Absolute integer start marker.
- **Duration Value**: Absolute integer length calculation.
- **EyeMovementType Value**: Deep binary classifier (`0` = Fixation, `1` = Saccade).
- **Metadata Values**: Standard semantic strings. For the `AOI` column, multiple AOIs can be assigned by separating them with a pipe character (`|`), e.g., `Header|Menu`.

#### Delimitation Constraints

- **Columns**: Strictly delimited by commas `,`.
- **Rows**: Standard carriage returns `\n`, `\r\n`, or `\r`.

#### Parsing Behavior

The system imports these rows and rapidly forces a mathematical re-normalization of all absolute timestamps.

**Baselines**: The very first sequential segment of any unique Participant × Stimulus combination is aggressively rewritten directly to an arbitrary `0` start time baseline.

> **Advanced Data Pipelines**: Because the Segmented Duration schema inherently normalizes time algorithms on ingestion, it acts as a powerful data cleaning pipeline. You can export data, crop out initialization instructions, and directly re-upload via this format to automatically reset your spatial time constraints. Read the [Segmented Data workflows](/docs/advanced/segmented-data-workflows/) guide for complex manipulations.

```csv
stimulus,participant,timestamp,duration,eyemovementtype,AOI
SMI Base,Anna,226.2,72,1,
SMI Base,Anna,298.2,120,0,Map
SMI Base,Anna,418.2,28,1,
SMI Base,Anna,446.2,208,0,Map|Menu
```
