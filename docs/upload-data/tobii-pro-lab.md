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

Pick one and click **Load data**. Custom markers must be exactly a start and an end marker separated by `;`.

### Spatial coordinates

If coordinate columns are present, each fixation segment stores one coordinate, in one coordinate frame per stimulus:

1. A stimulus with its own `Mapped fixation X [stimulus]` + `Mapped fixation Y [stimulus]` columns uses only those. An empty cell is a fixation that was not mapped onto the snapshot, so it gets no coordinate (it is never filled from `Fixation point`, which is in another frame).
2. A file with unsuffixed `Mapped fixation X` + `Mapped fixation Y` columns (a single-stimulus export) uses those the same way.
3. Otherwise, `Fixation point X` + `Fixation point Y`.

Both X and Y must be present; the first valid pair in a segment is used. Workspaces saved before GazePlotter 1.10.2 keep the coordinates they were parsed with until the data is uploaded again.

## Event data

To add dynamic AOI visibility as event channels:

1. In Tobii Pro Lab, open the **AOI** tab and **Export** the AOIs as a `.json` file.
2. In GazePlotter, select the `.tsv` and the `.json` together in the file picker.

When several files are selected, a Tobii AOI `.json` is recognized as an event file, and the **Map Event Files** modal appears after parsing. See [Event Data](/docs/upload-data/events/).

## Sample data

Download sample files from the [OSF Sample Data Storage](https://osf.io/j58v3).
