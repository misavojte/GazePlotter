# OGAMA upload

GazePlotter supports the upload of data from the [OGAMA](https://ogama.net) eye-tracking software.

> **Limited analysis capabilities**: Since OGAMA data is limited to ordinal timeline representation, this affects all analysis capabilities in GazePlotter:
>
> - **[AOI Comparison](/docs/visualizations/aoi-comparison/)** - Temporal metrics (like dwell time, time to first fixation) cannot be calculated accurately
> - **[Transition matrices](/docs/visualizations/transition-matrix/)** - Dwell time aggregation methods will not work properly
> - **[Scarf plots](/docs/visualizations/scarf-plot/)** - Only sequence order is preserved, not actual timing information
> - **[Export segmented data](/docs/export/segmented-data/)** - Temporal analysis in external tools will be limited
>
> For full temporal analysis capabilities, consider using eye-tracking software that supports absolute or relative timeline export.

## Export & upload

In the OGAMA software, select:

1. `Scanpath Module`
2. `Check to display Levenshtein Distance calculation tools`
3. `Use Areas of Interest to divide the stimulus picture into subsequences`
4. `Export similarity measurements to data sheet`
5. `Sequence Similarity`

Then click `OK` to export the data.

Select the exported file after clicking `Upload data` button (see more information in [Workspace & Setup overview](/docs/setup/)) in to start the upload and visualization.

## Sample data

You can download the sample data, including other formats, from [OSF Sample Data Storage](https://osf.io/j58v3).
