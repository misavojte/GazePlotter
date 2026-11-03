# Source Metadata

The Source Metadata view shows what was loaded and how it was parsed, plus live memory usage. Everything is computed locally in your browser.

## Opening it

Click **Metadata** (the document icon) in the header.

## What it shows

- **Data overview**: Counts of stimuli, participants, AOIs, event channels, and events in the current workspace, with AOIs and events per stimulus. **Capabilities** shows whether the data is segmented, spatial, and has events.
- **Excluded data (malformed interval markers)**: Shown only when interval markers did not pair. Lists the participant-stimulus groups left out of the dataset, with each issue and its time.
- **Current parsing**: Shown only when the data on screen differs from the original import (e.g. after editing): the files being processed, total size, and parse date.
- **Source parsing (original eye tracking export)**: Details of the original eye-tracking import:
  - Files processed, with sizes, and total size.
  - Parse duration and date.
  - GazePlotter version and browser (user agent).
  - Parse settings: format type, row and column delimiters, and any manual choices (such as the Tobii stimulus-parsing option).
  - Data imported before GazePlotter 1.7.0 has no source-parsing metadata, and a failed import shows the error message and ID instead.
- **Recent Errors**: Recent recoverable errors from this session, useful for troubleshooting.
- **RAM Usage**: Live JavaScript heap usage and limit, refreshed every couple of seconds.

## Exporting

Click **Export Metadata** to download everything shown as a `.csv`, handy for support requests or lab record-keeping.
