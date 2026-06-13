# Aggregated Data Export

Aggregated Data Export writes per-AOI summary metrics as a long-format CSV, ready for R, Python (pandas), SPSS, or Jamovi.

## CSV structure

One row per Participant × Stimulus × AOI × Metric:

| Column | Description |
| :--- | :--- |
| `Participant_ID` | Numeric participant identifier |
| `Participant_Name` | Displayed [participant name](/docs/setup/participant-library/) |
| `Stimulus` | Displayed [stimulus name](/docs/setup/stimuli-library/) |
| `AOI_Group` | Displayed [AOI name](/docs/setup/aoi-library/), or `No_AOI` / `Any_Fixation` |
| `Metric` | Metric name (e.g. `Dwell_Time`) |
| `Value` | Computed value |

`No_AOI` aggregates fixations outside every AOI; `Any_Fixation` aggregates all fixations on the stimulus.

```csv
Participant_ID,Participant_Name,Stimulus,AOI_Group,Metric,Value
1,"P01","Image1","Logo","Absolute_Dwell_Time",1250.5
1,"P01","Image1","Logo","Fixation_Count",3
1,"P01","Image1","No_AOI","Absolute_Dwell_Time",450.2
```

## Metrics

Select any of these. Metrics that require a visit return `-1` for AOIs the participant never fixated.

- **Absolute Dwell Time** (ms)
- **Relative Dwell Time** (% of viewing time)
- **Time to First Fixation** (ms; `-1` if never fixated)
- **First Fixation Duration** (ms; `-1` if never fixated)
- **Mean Fixation Duration** (ms; `-1` if never fixated)
- **Mean Visit Duration** (ms; `-1` if never fixated)
- **Fixation Count**
- **Visit Count** (consecutive fixations in the same AOI count as one visit)

## Exporting

1. Click **Export** in the workspace top bar.
2. In **Research Data Formats**, click the **Aggregated Data (CSV)** card.
3. Set the **File name**, **Participant Group**, **Delimiter** (`,` or `;`), and **Decimal Separator** (`.` or `,`).
4. Check the **Stimuli** and **Metrics** to include.
5. Click **Export CSV**.
