# Tobii Pro Lab

GazePlotter imports `.tsv` exports from Tobii Pro Lab.

## Export from Tobii Pro Lab

1. Open the **Analyze** tab and choose **Data Export**.
2. In the properties panel, set **Format** to `Single standard file (.tsv)`.
3. Include these columns (keeping the export small speeds up parsing). Spatial columns are optional.

| Column |
| :--- |
| Recording timestamp |
| Participant name |
| Recording name |
| Presented Stimulus name |
| Eye movement type |
| Eye movement type index |
| Event |
| Event value |
| AOI hit |

Optional spatial columns: `Mapped fixation X` / `Mapped fixation Y`, or `Fixation point X` / `Fixation point Y`.

4. Click **Export**.

## Upload

Click **Import** in the workspace and select the `.tsv` file.

### Stimulus parsing

After parsing, GazePlotter asks how to split the recording into stimuli:

- **Media Column** — Use the `Presented Stimulus name` column. For screen-based experiments.
- **Interval Events** — Use `IntervalStart` / `IntervalEnd` markers in the Event column. For glasses experiments.
- **Web Stimulus Events** — Treat each visited URL as its own stimulus.
- **Custom Markers** — Define your own start/end marker strings (e.g. `_start;_end`).

### Spatial coordinates

If coordinate columns are present, each fixation segment stores one coordinate, chosen in this order:

1. `Mapped fixation X` + `Mapped fixation Y` (preferred)
2. `Fixation point X` + `Fixation point Y` (fallback)
3. None, if neither complete pair is available

Both X and Y must be present; the first valid pair in a segment is used.

## Event data

To add dynamic AOI visibility as event channels:

1. In Tobii Pro Lab, open the **AOI** tab and **Export** the AOIs as a `.json` file.
2. In GazePlotter, select the `.tsv` and the `.json` together in the file picker.

When several files are selected, a Tobii AOI `.json` is recognized as an event file, and the **Map Event Files** modal appears after parsing. See [Event Data](/docs/upload-data/events/).

## Sample data

Download sample files from the [OSF Sample Data Storage](https://osf.io/j58v3).
