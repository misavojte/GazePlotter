---
title: Bar Plot
order: 5
---

# Bar Plot

Bar Plot in GazePlotter provides quantitative analysis of eye-tracking data through bar charts. It aggregates gaze metrics across Areas of Interest (AOIs) for statistical comparison and analysis.

![](/docs/images/eyetracking-bar-plot-gazeplotter.jpg)

::: tip Bar plot manipulations in Workspace
Interested on how to operate with plots in general within the workspace? See:

- [How to move a plot around workspace?](/docs/basic/workspace/#how-to-move-a-plot-around-workspace)
- [How to resize a plot?](/docs/basic/workspace/#how-to-resize-a-plot)
- [How to duplicate a plot?](/docs/basic/workspace/#how-to-duplicate-a-plot)
- [How to add a new plot?](/docs/basic/workspace/#how-to-add-a-new-plot)
- [How to remove a plot?](/docs/basic/workspace/#how-to-remove-a-plot)
  :::

## Overview

The Bar Plot visualization displays quantitative metrics for each AOI in your selected stimulus, allowing you to compare attention patterns, fixation durations, and other gaze measurements across different areas of interest.

## Main Controls

### Stimulus Selection

Choose which stimulus to analyze using the `Stimulus` dropdown. Each stimulus contains its own set of AOIs that will be displayed as bars in the chart.

### Group Selection

Select participant groups using the `Group` dropdown:

- **All participants** - includes data from all participants
- **Custom groups** - analyze specific participant groups created in the grouping interface

### Aggregation Methods

The `Aggregation` dropdown determines what metric is calculated and displayed:

#### Absolute times

- **Description**: Total time spent in each AOI across all participants, summing all fixation durations
- **Values**: Time in milliseconds
- **Use case**: Understanding total attention allocation across AOIs

#### Relative times

- **Description**: Proportional time spent in each AOI as percentages of total viewing time
- **Values**: Percentages (0-100%) where all AOIs sum to 100%
- **Use case**: Understanding attention distribution as proportions

#### Mean visits

- **Description**: Average number of distinct encounters participants had with each AOI
- **Values**: Decimal numbers (e.g., 2.3, 1.7)
- **Use case**: Understanding how often participants return to or revisit each AOI

#### Mean visit durations

- **Description**: Average duration of each visit (consecutive fixations) to each AOI
- **Values**: Time in milliseconds per visit
- **Use case**: Understanding how long participants typically stay during each visit to an AOI

#### Mean fixation counts

- **Description**: Average number of separate fixations per participant for each AOI
- **Values**: Decimal numbers (e.g., 5.2, 3.8)
- **Use case**: Understanding fixation density and attention granularity

#### Mean fixation durations

- **Description**: Average length of all individual fixations within each AOI across participants
- **Values**: Time in milliseconds per fixation
- **Use case**: Understanding cognitive processing depth for each AOI

#### Mean times to first fixation

- **Description**: Average time when participants first looked at each AOI (from stimulus start)
- **Values**: Time in milliseconds
- **Use case**: Understanding visual salience and attention capture speed

#### Mean first fixation durations

- **Description**: Average duration of the very first fixation each participant made on each AOI
- **Values**: Time in milliseconds
- **Use case**: Understanding initial cognitive processing and attention engagement

#### Hit ratios (seen %)

- **Description**: Percentage of participants who looked at each AOI at least once
- **Values**: Percentages (0-100%)
- **Use case**: Understanding AOI visibility and reach across participants

## Chart Features

### Bar Display

- **Orientation** - bars can be displayed horizontally (default) or vertically
- **Numeric values** - exact measurements are displayed at the end of each bar
- **Color coding** - bars use the same colors as defined in AOI customization
- **Proportional length** - bar length reflects the relative magnitude of values

### Interactive Elements

- **Menu button** (⋮) - provides access to additional customization options
- **Responsive sizing** - chart automatically adjusts to available space

## Customization Options

### Bar Chart Axes

Access advanced customization through the menu button (⋮) to open the "Bar Chart Axes" dialog:

#### Bar Orientation

Choose how bars are displayed:

- **Vertical** - bars extend upward from a horizontal baseline
- **Horizontal** - bars extend rightward from a vertical baseline (default)

#### Bar Sorting

Control the order in which AOIs appear:

- **None (Original Order)** - maintains the original AOI order from your data
- **Ascending (By Value)** - sorts bars from smallest to largest values
- **Descending (By Value)** - sorts bars from largest to smallest values

#### Scale Range

Customize the chart's value axis:

- **Min Value** - set the minimum value for the scale (0 for automatic)
- **Max Value** - set the maximum value for the scale (0 for automatic scaling)
- **Automatic scaling** - when both values are 0, the chart automatically adjusts to fit your data

::: tip Scale Range Usage
Use custom scale ranges to standardize comparisons across different datasets or to zoom into specific value ranges for better detail visibility.
:::

All customization changes require clicking **Apply** to take effect.

## Download Plot

Export individual bar plots as image files through the menu button (⋮) → **Download plot**:

### Export Options

- **File formats**: PNG (recommended) or JPG
- **Dimensions**: Customizable width (height calculated automatically at 5:3 aspect ratio)
- **Quality**: Adjustable DPI setting for print or web use
- **Margins**: Configurable top, right, bottom, left margins
- **Preview**: Live preview of your exported plot before downloading

### Usage

1. Click the menu button (⋮) in the bar plot
2. Select **Download plot**
3. Adjust export settings as needed
4. Preview your plot in the dialog
5. Click **Download** to save the file

## Export Data

Export the calculated statistical data for external analysis through the menu button (⋮) → **Export aggregated data**.

This provides access to all computed eye-tracking metrics (absolute time, relative time, fixation counts, etc.) in CSV format for analysis in R, Python, SPSS, or other statistical software.

For detailed information about data export options and formats, see [Aggregated Data Export](/docs/export/aggregated-data/).

## Additional Menu Options

The bar plot menu (⋮) provides quick access to customization features:

- **AOI customization** - Modify colors, names, and order of Areas of Interest. See [AOI Customization](/docs/basic/aoi-customization/) for details.
- **Stimulus customization** - Manage stimulus properties and settings. See [Stimuli Customization](/docs/basic/stimuli-customization/) for details.
- **Setup participants groups** - Create and modify participant groups for comparative analysis. See [Participant Groups](/docs/basic/groups/) for details.

These options allow you to modify your data presentation without leaving the bar plot view.

## Interpretation

Use Bar Plot to:

- **Compare AOI performance** - identify which areas attract most/least attention
- **Quantify differences** - get precise measurements rather than visual estimates
- **Group comparisons** - analyze how different participant groups behave
- **Statistical analysis** - export exact values for further statistical processing
