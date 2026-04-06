---
title: Event Data
order: 9
---

# Event data

GazePlotter supports the upload of event data files that add time-based information layers to scarf plots. Event channels represent temporal intervals — for example, dynamic AOI visibility periods — and are rendered as colored lines beneath each participant's gaze sequence.

## Supported sources

Event data can be exported from the following eye-tracking platforms:

- **[SMI BeGaze](/docs/upload-data/smi-begaze/)** — XML export from the AOI Editor
- **[Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/)** — JSON export from the AOI tab

Additionally, GazePlotter accepts a **Custom CSV** format for manual event definitions. See [Custom CSV event format](#custom-csv-event-format) below.

### Exporting from SMI BeGaze

1. Open **AOI Editor** in the SMI BeGaze software.
2. Click **Save** to export the AOI visibility data as an `.xml` file.

### Exporting from Tobii Pro Lab

1. Open the **AOI** tab in Tobii Pro Lab.
2. Click **Export** to export the AOI data as a `.json` file.

## Uploading event files

Event files must be uploaded together with eye-tracking data files in the same file selection. They cannot be uploaded separately.

1. Click **Import** in the workspace header.
2. In the file picker, select both your eye-tracking data files and your event files.
3. Click **Open** to start the upload.

GazePlotter automatically separates event files from eye-tracking data:

- All `.xml` files are classified as event files (SMI BeGaze format).
- `.json` files are classified as event files only when multiple files are selected and the file matches the Tobii AOI format. A single `.json` file is always treated as a workspace import.

After the eye-tracking data is parsed and loaded, the **Map Event Files** modal appears automatically.

## Mapping event files

The **Map Event Files** modal assigns each detected event file to a stimulus and participant scope.

For each event file, select:

- **Stimulus** — The stimulus the event file belongs to.
- **Participant** — One of:
  - **Ignore** (default) — Skip this file entirely.
  - **To all** — Apply the event data to every participant.
  - A specific participant name — Apply only to that participant.

> **Note**: When any file is set to **To all**, individual participant options are hidden for other files targeting the same stimulus.

Click **Apply** to process the mapping. The event channels are immediately added to the scarf plot for the assigned stimulus.

## Custom CSV event format

You can define event channels manually using a CSV file with the following required columns:

| Column | Type | Description |
| :--- | :--- | :--- |
| `stimulus` | string | Must match a stimulus name in the loaded data |
| `participant` | string | Must match a participant name, or `*` to apply to all participants |
| `eventName` | string | Event channel name |
| `start` | number | Start time in milliseconds |
| `duration` | number | Duration in milliseconds (use `0` for instant events) |

Example:

```
stimulus,participant,eventName,start,duration
Image1,P01,AOI_Face,0,500
Image1,P01,AOI_Face,1200,300
Image1,*,Marker,2000,0
```

The delimiter is auto-detected (`,` or `;`). Columns can appear in any order.

Custom CSV event files are self-describing — they contain stimulus and participant information directly, so the **Map Event Files** modal does not appear for them. Rows referencing unrecognized stimulus or participant names are skipped with a warning.

Custom CSV event files can be uploaded together with SMI or Tobii event files in the same file selection. All sources are merged before being applied.

## After uploading

Event channels appear as colored lines in the scarf plot beneath each participant's gaze row. To modify event channel names, colors, ordering, or visibility, use **Event customization** from the scarf plot menu. See [Event Customization](/docs/basic/event-customization/) for details.

> **Note**: When multiple event files target the same stimulus, channels with the same name are merged — their event buffers are concatenated per participant rather than overwritten.
