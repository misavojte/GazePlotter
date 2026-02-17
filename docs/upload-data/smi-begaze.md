---
title: SMI BeGaze upload
order: 3
outline: deep
---

# SMI BeGaze upload

GazePlotter supports the upload of data from the SMI BeGaze eye-tracking software, which is currently unfortunately no longer supported. Some researchers still use this software, and we want to support them in visualizing their data.

From SMI BeGaze, you can visualize eye-tracking AOI data with all timeline types (absolute, relative, and ordinal). You can also visualize dynamic AOI visibility information.

## Export & upload basic data

### No overlaying AOIs

If you don't have multiple AOI hits in the same fixation (caused by AOI overlay), the `.csv` file can be exported from the SMI BeGaze software by selecting

1. `Export`
2. `Metrics Export`
3. `Event Statistics`
4. `Single`

In this tab, check the following metrics for export:

| Column Group             | Column Name                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| Presentation Information | Stimulus                                                                  |
| Participant Information  | Participant                                                               |
|                          | Participant Properties<br>\*if participant attributes needed for analysis |
| General Information      | Category                                                                  |
| AOI Information          | AOI Name                                                                  |
| Event Details            | Event Start Trial Time [ms]                                               |
|                          | Event End Trial Time [ms]                                                 |

Make sure that columns are separated by a tabulator (`tab`) and decimal separator is a point (`.`).

Then click `Export` to export the data.

The exported `.csv` file can be then simply uploaded to the workspace by clicking the `Upload data` button (see [GazePlotter GUI overview](/docs/basic/)) and selecting this file for upload.

### Data with overlaying AOIs

If you have multiple AOI hits in the same fixation (caused by AOI overlay), firstly export data as in the previous section.

Then, in the SMI BeGaze software, select:

1. `Export`
2. `Metrics Export`
3. `AOI Statistics`
4. `Single`

| Column Group             | Column Name                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| Presentation Information | Stimulus                                                                  |
| Participant Information  | Participant                                                               |
|                          | Participant Properties<br>\*if participant attributes needed for analysis |
| General Information      | Category                                                                  |
| AOI Information          | AOI Name                                                                  |
| Event Details            | Event Start Trial Time [ms]                                               |
|                          | Event End Trial Time [ms]                                                 |

Make sure that columns are separated by a comma (`tab`) and decimal separator is a point (`.`).

Then click `Export` to export the data.

After that, click the `Upload data` button (see [GazePlotter GUI overview](/docs/basic/)) and select both the first exported `.csv` file and the second one for starting the upload and visualization.

## Adding dynamic AOI visibility information

If you have dynamic AOI visibility information you wish to visualize, firstly export and upload the data as in the one of the previous sections. Then follow instruction in [Adding AOI visibility data](/docs/basic/scarf-plot/#adding-aoi-visibility-data) section.

## Sample data

You can download the sample data, including other formats, from [OSF Sample Data Storage](https://osf.io/j58v3).
