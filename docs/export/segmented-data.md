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

- **Export Type** — **Single CSV File**, or **Individual CSV Files (Zipped)** (one file per participant).
- **File name**, **Delimiter** (`,` or `;`), **Decimal Separator** (`.` or `,`).
- **Stimuli** — Select which stimuli to include.
- **Participants** — Select which participants to include; the group chips above the list select or deselect an entire participant group at once.
- **Export only fixations** — Exclude saccades, blinks, and other non-fixation segments.

## Exporting

The modal guides you through collapsible steps, one open at a time; every collapsed step shows a one-line summary of its selection.

1. Click **Export** in the workspace top bar.
2. In **Research Data Formats**, click the **Segmented Data (CSV)** card.
3. Choose the **Stimuli** and **Participants**, then configure the file options above.
4. Click **Export Data**.
