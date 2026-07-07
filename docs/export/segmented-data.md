# Segmented Data Export

Segmented Data Export writes raw, row-level gaze segments as CSV — for spreadsheets or custom scripts (Python, R). The layout matches the [Segmented Duration CSV](/docs/upload-data/custom-csv/#format-3-segmented-duration-csv) import format, so you can export, edit, and re-upload (see [Segmented Data workflows](/docs/advanced/segmented-data-workflows/)).

## CSV structure

| Column | Description |
| :--- | :--- |
| `stimulus` | Stimulus name |
| `participant` | Participant name |
| `timestamp` | Segment start time |
| `duration` | Segment duration |
| `eyemovementtype` | `0` = fixation, otherwise saccade |
| `AOI` | AOI name(s); multiple are `;`-separated |
| `x`, `y` | Segment coordinate, when spatial data is available |

## Options

- **Choose stimuli** — Select which stimuli to include in the exported data.
- **Choose participants** — Select which participants to include; the group chips above the list select or deselect an entire participant group at once.
- **Choose eye-movement types** — Select which eye-movement categories (e.g., fixations, saccades, unclassified) to include in the file. By default, all categories are selected.
- **Configure the file** — Choose the export layout and format conventions:
  - **Export Type** — **Single CSV File**, or **Individual CSV Files (Zipped)** (one file per participant).
  - **Delimiter** (`,` or `;`), **Decimal Separator** (`.` or `,`).
  - **Naming** — **Displayed** (grouped, renamed) or **Raw** (original imported).

## Exporting

The modal guides you through collapsible steps, one open at a time; every collapsed step shows a one-line summary of its selection.

1. Click **Export** in the workspace Ribbon.
2. Under **Other options**, click the **Segmented Data (CSV)** card.
3. Choose the **Stimuli**, **Participants**, and **Eye-movement types**, then configure the file options above.
4. Click **Export Data**.
