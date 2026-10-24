# Event Data Export

The **Event Data (CSV)** export writes every event occurrence with its timing, per participant and stimulus. The card appears in the export menu only when the loaded dataset contains [event data](/docs/upload-data/events/).

## CSV format

| Column | Description |
| :--- | :--- |
| `stimulus` | Stimulus name |
| `participant` | Participant name |
| `eventName` | Event channel name |
| `start` | Occurrence start time in milliseconds |
| `duration` | Occurrence duration in milliseconds; `0` marks an instant event |

> **Round Trip**: A single-file export matches the [Custom CSV event format](/docs/upload-data/events/) and can be re-imported alongside its eye-tracking data.

## Options

- **Export Type**: **Single CSV File**, or **Individual CSV Files (Zipped)** (one file per participant and stimulus, without the `stimulus` and `participant` columns).
- **Delimiter** (`,` or `;`), **Decimal Separator** (`.` or `,`). Each CSV export starts from the delimiter and decimal separator of your last CSV export in this tab, and the collapsed step names them when they are not comma and dot.
- **Stimuli**: Select which stimuli to include.
- **Participants**: Select which participants to include; the selection chips above the list select or deselect an entire [participant selection](/docs/workspace/participant-library/#participant-selections) at once.
- **Event channels**: Select which channels to include, by displayed name (all are ticked by default). Your [event selections](/docs/workspace/event-library/) appear as chips above the list and work like the participant chips. With **Raw** naming, every imported channel whose displayed name is ticked is kept, so channels merged under one name stay together.
- **Naming**: **Displayed** uses your renamed event names, merges channels grouped under the same name, and includes derived interval channels (the on-screen result). **Raw** uses the original imported channel names with no grouping and excludes derived interval channels. A plot's event selection never filters the export; the **Event channels** step does. Channels are managed in the [event library](/docs/workspace/event-library/).

## Exporting

The modal guides you through collapsible steps, one open at a time; every collapsed step shows a one-line summary of its selection.

1. Click **Export** in the header.
2. Under **Figures and data**, click the **Event Data (CSV)** card.
3. Choose the **Stimuli**, **Participants** and **Event channels**, then configure the file options above.
4. Click **Export Events**.
