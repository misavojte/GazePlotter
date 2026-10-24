# Metric Data Export

The **Metric Data (CSV)** export extracts any configured metric from the workspace [metric library](/docs/metrics/) as CSV. It supports both **Long (tidy)** and **Wide** layouts, optional temporal filtering, and a sidecar provenance codebook.

AOIs are identified by their displayed name throughout: AOIs sharing a displayed name are merged, within a stimulus and across stimuli, matching the behavior everywhere else in the application. The names `No_AOI` and `Any_Fixation` are reserved for the synthetic slots (fixations outside every AOI, and the all-fixations aggregate).

## Layout Formats

### Long (tidy) Format

Best suited for analysis in modern statistical languages (R, Python Pandas, Julia) and software like JASP or jamovi. Emits one row per observation. Active dimension columns are dynamically included only when needed by the selected metrics:

- Scalar metrics: stimulus × participant rows.
- AOI-vector metrics: adds the `AOI` column (stimulus × participant × slot).
- AOI-pair-matrix metrics: adds the `From_AOI` and `To_AOI` columns (stimulus × participant × cell).
- Windowed metrics: adds the `Window_Start` and `Window_End` columns (stimulus × participant × window). Windows cover each participant's own recording, so a participant who stopped recording early has fewer window rows, never padded zeros.
- Participant-pair-matrix metrics: adds the `Participant_B` column (stimulus × unordered pair).

#### Example CSV Output

```csv
Participant_ID,Participant,Stimulus,AOI,Metric,Unit,Value
1,P01,Stimulus1,Logo,Fixation count,,3
1,P01,Stimulus1,No_AOI,Fixation count,,1
1,P01,Stimulus1,,Average fixation duration,ms,250.5
```

Fields are quoted only when they contain the delimiter, quotes, or line breaks.

### Wide Format

Best suited for case-per-row analysis in traditional software like IBM SPSS. Emits one row per participant × stimulus case. Values are expanded into separate columns:

- Scalar metrics → `<Label>` column.
- AOI-vector metrics → `<Label>_<AOI>` column per slot (including `No_AOI` and `Any_Fixation`).
- AOI-pair-matrix metrics → `<Label>_<From>_to_<To>` column per cell.
- Participant-pair metrics (e.g. scanpath similarity) → `<Label>_<Participant>` column per participant in the group. Each row holds participant A's line of the similarity matrix, so the wide file IS the full matrix grid, diagonal included.

Spaces in names become underscores (e.g. `Absolute_dwell_time_Face`), and a header that would repeat gets a `_2`, `_3` suffix.

> **Temporal Exclusion**: Wide format excludes windowed metrics, as mixed-grain wide tables are statistically unsound. Export time series in the long format instead.

#### Example CSV Output

```csv
Participant_ID,Participant,Stimulus,Fixation_Count_Logo,Fixation_Count_No_AOI,Average_fixation_duration
1,"P01","Stimulus1",3,1,250.5
2,"P02","Stimulus1",5,0,220.1
```

## Missing Values

Missing values (for example, a participant who never fixated on an AOI when computing **Time to First Fixation**) are exported as **empty cells**. 

> **No Sentinel Values**: Sentinel values like `-1` are never used, preventing downstream statistical models (such as group means) from being silently poisoned by negative numbers.

## Sidecar Codebook

Checking the **Include metric codebook** option downloads the export as a ZIP archive containing three files, named after the loaded data file (`data` below; `GazePlotter` when there is none):
1. `data-MetricData.csv`: the dataset itself.
2. `data-MetricData-codebook.csv`: a sidecar table detailing the operational parameters and provenance of every exported column.
3. `data-MetricData.analysis.json`: the workspace's [Analysis](/docs/advanced/headless/#the-analysis): the renames, merges, selections, and metric definitions behind the table, which the command line replays on other recordings.

The codebook contains the following columns:

| Column | Description |
| :--- | :--- |
| `Metric` | The column label used in the data CSV |
| `Metric_ID` | The metric instance's id, as it appears in the Analysis JSON |
| `Base_Metric` | The metric's original registry name |
| `Base_Id` | The unique recipe identifier |
| `Unit` | Measurement units (e.g. `ms`, `%`, or empty for dimensionless) |
| `Measurement_Class` | Statistical class of the metric: `extensive` (counts, summed durations), `intensive` (rates, averages, latencies), `proportion` (binary indicators), or `relational` (participant-pair) |
| `Parameters` | Active parameters, as shown in the metric library (e.g. `Fixation pairs, Step 2`) |
| `Projection` | Selected projection (e.g. `max across AOIs`) |
| `Window` | Windowing parameters (e.g. `1000 ms window, 100 ms step`) |
| `Output_Shape` | Reshaped dimension classification |
| `Time_Range` | Range restriction (e.g. `t ∈ [500, 2000] ms` or `full`) |
| `Participants` | List of participants included |
| `Stimuli` | List of stimuli included |
| `AOI_Missing` | Displays `true` if any stimulus lacked the AOI referenced by a projection |

## Exporting Data

The modal guides you through four collapsible steps, one open at a time. Every collapsed step shows a one-line summary of its current selection, and its badge turns into a check when the step is complete.

1. Open the **Export** menu in the header and select **Metric Data (CSV)**. Or click **Download data** in a metric plot's pane: the steps then start preset to that plot's metrics, stimulus, participant selection and time range.
2. **Choose metrics**: check the metrics to include. On longer lists a search bar appears; **Select Found** and **Deselect Found** apply the current matches to the selection in one click.
3. **Choose stimuli** and **Choose participants**: check items the same way. The selection chips above the participant list select or deselect an entire [participant selection](/docs/workspace/participant-library/#participant-selections) at once; individual checkmarks refine the result.
4. **Configure the file**: choose the **Format** (**Long (tidy)** or **Wide**), and the **Delimiter** and **Decimal Separator** according to your regional system settings. Optional: enter **Time Start (ms)** and **Time End (ms)** boundary limits to crop the evaluation window (leave them empty for the full recording). The step ends with a preview of the exact columns the file will contain. Switching to **Wide** deselects time-series metrics and says so.
5. Click **Export Metrics**.

> **Sliding Windows**: Sliding-window metrics evaluate dense overlaps and can generate very large files. Opt-in to windowed metrics explicitly when exporting.
