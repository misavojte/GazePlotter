# Source Metadata

The Source Metadata view shows what was loaded and how it was parsed, plus live memory usage. Everything is computed locally in your browser.

## Opening it

Click **Metadata** (the document icon) in the workspace top bar.

## What it shows

- **Data overview** — Counts of stimuli, participants, and AOIs in the current workspace, including the AOI count per stimulus.
- **Current parsing** — Shown only when the data on screen differs from the original import (e.g. after editing): the files being processed, total size, and parse date.
- **Source parsing** — Details of the original eye-tracking import:
  - Files processed, with sizes, and total size.
  - Parse duration and date.
  - GazePlotter version and browser (user agent).
  - Parse settings: format type, row and column delimiters, and any manual choices (such as the Tobii stimulus-parsing option).
  - Data imported before GazePlotter 1.7.0 has no source-parsing metadata, and a failed import shows the error message and ID instead.
- **Recent errors** — Recent recoverable errors from this session, useful for troubleshooting.
- **Memory** — Live JavaScript heap usage and limit, refreshed every couple of seconds.

## Exporting

Click **Export Metadata** to download everything shown as a `.csv` — handy for support requests or lab record-keeping.
