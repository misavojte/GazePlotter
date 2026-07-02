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

- **Export Type** — **Single CSV File**, or **Individual CSV Files (Zipped)** (one file per participant and stimulus).
- **File name**, **Delimiter** (`,` or `;`), **Decimal Separator** (`.` or `,`).
- **Stimuli** — Select which stimuli to include.
- **Participants** — Select which participants to include; the group chips above the list select or deselect an entire [participant group](/docs/setup/participant-groups/) at once.
- **Naming** — **Displayed** uses your renamed event names, merges channels grouped under the same name, hides hidden channels, and includes derived interval channels (the on-screen result). **Raw** uses the original imported channel names with no grouping and excludes derived interval channels. Channels are managed in the [event library](/docs/setup/event-library/).

## Exporting

The modal guides you through collapsible steps, one open at a time; every collapsed step shows a one-line summary of its selection.

1. Click **Export** in the workspace top bar.
2. In **Research Data Formats**, click the **Event Data (CSV)** card.
3. Choose the **Stimuli** and **Participants**, then configure the file options above.
4. Click **Export Data**.
