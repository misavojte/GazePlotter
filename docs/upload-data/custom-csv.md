# Custom CSV

GazePlotter reads three custom CSV layouts. Use them to import data from non-standard trackers or your own processing pipeline. Pick the one that matches your data and use its exact header row.

## Shared rules

- **Headers** are case-sensitive and must match exactly (except optional `X`/`Y`, which are case-insensitive).
- **Column delimiter** is auto-detected: `,` or `;`. Row breaks may be `\n`, `\r\n`, or `\r`.
- **AOI column** can hold multiple AOIs per row, separated by a pipe: `Header|Menu`.
- **Optional `X`/`Y` columns** add a spatial coordinate. Both must be numeric on a row, or that row contributes no coordinate. The first valid pair in a segment is used.

## Format 1: Time series

One row per time sample. Segments are detected automatically: a new segment starts whenever the `AOI`, `Participant`, or `Stimulus` value changes.

- **Headers**: `Time`, `Participant`, `Stimulus`, `AOI` (optional `X`, `Y`).
- **Time**: integer timestamp (no units or thousands separators).

```csv
Time,Participant,Stimulus,AOI
0,Participant 1,Stimulus 1,AOI 1
25,Participant 1,Stimulus 1,AOI 1
50,Participant 1,Stimulus 1,AOI 1|AOI 3
75,Participant 1,Stimulus 1,AOI 2
```

## Format 2: Segmented (from/to)

Each row is one complete segment, bounded by start and end timestamps.

- **Headers**: `From`, `To`, `Participant`, `Stimulus`, `AOI` (optional `X`, `Y`).
- **From** / **To**: integer start and end timestamps.

```csv
From,To,Participant,Stimulus,AOI
0,100,Participant 1,Stimulus 1,AOI 1
100,125,Participant 1,Stimulus 1,AOI 2|AOI 3
200,300,Participant 1,Stimulus 2,AOI 1
```

## Format 3: Segmented Duration CSV

Each row is one segment defined by a start time and a duration. Timestamps are normalized on import: the first segment of each Participant × Stimulus is reset to start at `0`.

- **Headers**: `stimulus`, `participant`, `timestamp`, `duration`, `eyemovementtype`, `AOI` (optional `X`, `Y`).
- **timestamp** / **duration**: numeric start and length.
- **eyemovementtype**: `0` = fixation, any other value = saccade.

```csv
stimulus,participant,timestamp,duration,eyemovementtype,AOI
SMI Base,Anna,226.2,72,1,
SMI Base,Anna,298.2,120,0,Map
SMI Base,Anna,418.2,28,1,
SMI Base,Anna,446.2,208,0,Map|Menu
```

> Because this format renormalizes time on import, it doubles as a cleaning pipeline: export your data, edit it in a spreadsheet, and re-upload. See [Segmented Data workflows](/docs/advanced/segmented-data-workflows/).
