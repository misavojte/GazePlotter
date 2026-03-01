---
title: Varjo upload
order: 6
---

# Varjo XR export and upload

GazePlotter supports the upload of data from the Varjo XR eye-tracking software.

## Export

Before conducting the experiment, you must set up the logging in Varjo XR software.

In this software, select `Tools > Analytics > Eye tracking > Log eye tracking data while screen recording`. Then click `Screen recording` to start the recording.

Data are then automatically saved in `C: > Users > username > Videos > Varjo` folder on your Windows computer. The data file is in CSV format and contains a timeline of the recording with x-y coordinates for gaze positions.

## Upload

Multiple files are created during the recording. To GazePlotter, only the `gaze.csv` file is important - select it after clicking `Upload data` button (see [GazePlotter GUI overview](/docs/basic/)).

> **Tip**: If you want to upload data from multiple participants, you can upload multiple files at once. Just select all the files you want to upload.
