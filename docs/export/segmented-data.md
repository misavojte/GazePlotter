# Segmented Data Export

Segmented Data Export writes raw, row-level gaze segments as CSV — for spreadsheets or custom scripts (Python, R). The layout matches the [Segmented Duration CSV](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv) import format, so you can export, edit, and re-upload (see [Segmented Data workflows](/docs/advanced/segmented-data-workflows/)).

## CSV structure

| Column | Description |
| :--- | :--- |
| `stimulus` | Stimulus name |
| `participant` | Participant name |
| `timestamp` | Segment start time |
| `duration` | Segment duration |
| `eyemovementtype` | Eye-movement type name (e.g. Fixation, Saccade), displayed or raw per **Naming** |
| `AOI` | AOI name(s); multiple are `;`-separated |
| `x`, `y` | Segment coordinate, when spatial data is available |

## Options

- **Choose stimuli** — Select which stimuli to include in the exported data.
- **Choose participants** — Select which participants to include; the group chips above the list select or deselect an entire participant group at once.
- **Choose eye-movement types** — Select which eye-movement categories (e.g., fixations, saccades, unclassified) to include in the file. By default, all categories are selected.
- **Configure the file** — Choose the export layout and format conventions:
  - **Export Type** — **Single CSV File**, or **Individual CSV Files (Zipped)** (one file per participant and stimulus, without the `stimulus` and `participant` columns).
  - **Delimiter** (`,` or `;`), **Decimal Separator** (`.` or `,`). Each CSV export starts from the delimiter and decimal separator of your last CSV export in this tab, and the collapsed step names them when they are not comma and dot.
  - **Naming** — **Displayed** (grouped, renamed) or **Raw** (original imported).

## Exporting

The modal guides you through collapsible steps, one open at a time; every collapsed step shows a one-line summary of its selection.

1. Click **Export** in the header.
2. Under **Figures and data**, click the **Segmented Data (CSV)** card.
3. Choose the **Stimuli**, **Participants**, and **Eye-movement types**, then configure the file options above.
4. Click **Export Segments**.

**Download segments** in the pane of a Scarf Plot, Fixation Heatmap, Scanpath or Recurrence Plot opens the same dialog preset to that plot's stimulus and participants. The file holds whole recordings: a plot's time range or AOI selection is not applied.
