---
title: Time-binned AOI Occupancy
order: 6
---

# Time-binned AOI Occupancy

Time-binned AOI Occupancy in GazePlotter provides a continuous visualization of how visual attention is distributed across Areas of Interest (AOIs) over time. By segmenting the timeline into discrete bins, this plot reveals the dynamic flow and density of participants' gaze, making it easier to identify peak attention periods and shifts between AOIs.

![](/docs/images/eyetracking-aoi-stream-gazeplotter.jpg)

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/basic/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/basic/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/basic/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/basic/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/basic/workspace/#removing-a-plot)

## Overview

The Time-binned AOI Occupancy plot calculates the proportion of participants looking at each AOI within specific time intervals (bins). It offers multiple alignments (Stream, Distribution, Ridgeline, and Heatmap) to accommodate different analytical needs regarding temporal attention flow.

## Basic Controls

In GazePlotter, the occupancy plots have the following main controls:

- **[Stimulus](#stimulus)** - a drop-down menu for selecting the stimulus to be analyzed.
- **[Group](#group)** - a drop-down menu for selecting the participant group.
- **[View](#view)** - a drop-down menu for selecting the visual representation of the binned data.
- **[More options](#more-options)** (⋮) - a button for accessing additional customization and export options.

### Stimulus

Choose which stimulus to analyze. Each stimulus contains its own set of AOIs that will be displayed in the occupancy plot.

### Group

Select participant groups:

- **All participants** - includes data from all participants
- **Custom groups** - analyze specific participant groups created in the grouping interface. See [Participant Groups](/docs/basic/groups/).

### View

The `View` dropdown determines how the time-binned data is visually arrayed. Clicking on a view option opens a settings dialog with customizable parameters for the plot.

#### Stream

A centered, flowing river-like visualization. It highlights the shifting volume of attention across AOIs without pinning data to a flat baseline, making broad temporal trends easily visible.

| Parameter     | Description                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| Bin Size [ms] | The temporal duration of each individual analysis bin                         |
| Timeline [ms] | Limit the temporal bounds displayed in the plot (Start / End, where 0 = Auto) |

#### Distribution

A stacked area chart that uses a flat zero-baseline. This makes it easier to track the exact proportion or total occupancy of specific AOIs over time compared to the stream view.

| Parameter     | Description                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| Bin Size [ms] | The temporal duration of each individual analysis bin                         |
| Timeline [ms] | Limit the temporal bounds displayed in the plot (Start / End, where 0 = Auto) |

#### Ridgeline

Overlapping density curves for each AOI, resembling a mountain range. This view is excellent for comparing peak attention times across AOIs independently.

| Parameter     | Description                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| Bin Size [ms] | The temporal duration of each individual analysis bin                                 |
| Ridge Scale   | Controls the vertical overlap (scale factor) between adjacent AOI density "mountains" |
| Timeline [ms] | Limit the temporal bounds displayed in the plot (Start / End, where 0 = Auto)         |

#### Heatmap

A grid-based visualization where rows represent AOIs, and color intensity represents the proportion of attention during each bin.

| Parameter     | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| Bin Size [ms] | The temporal duration of each individual analysis bin                             |
| Timeline [ms] | Limit the temporal bounds displayed in the plot (Start / End, where 0 = Auto)     |
| Color Scale   | Select the minimum, middle, and maximum colors for the heatmap intensity gradient |

### More options

The occupancy plot menu (⋮) provides quick access to customization and specific features:

#### Customization Options

- **AOI customization** - Modify colors, names, and order of Areas of Interest. See [AOI Customization](/docs/basic/aoi-customization/) for details.
- **Stimulus customization** - Manage stimulus properties and settings. See [Stimuli Customization](/docs/basic/stimuli-customization/) for details.
- **Participant customization** - Customize individual participant properties and metadata. See [Participants Customization](/docs/basic/participants-customization/) for details.
- **Setup participants groups** - Create and modify participant groups for comparative analysis. See [Participant Groups](/docs/basic/groups/) for details.

#### Download plot

Export individual occupancy plots as image files:

- **File formats**: PNG (recommended, transparent background) or JPG (white background)
- **Dimensions**: Customizable width (height calculated automatically based on content)
- **Quality**: Adjustable DPI setting for screen (96 DPI) or print (300 DPI) use
- **Margins**: Configurable top, right, bottom, left margins
- **Preview**: Live preview of your exported plot before downloading

## Interpretation

Use Time-binned AOI Occupancy to:

- **Analyze attention shifts** - observe when participants collectively move their gaze from one AOI to another
- **Identify peak engagement** - pinpoint the exact moments when specific features receive maximum visual attention
- **Compare group synchrony** - assess whether different participant groups exhibit distinct or synchronized gaze behaviors over time
- **Evaluate temporal distribution** - gauge whether an AOI receives sustained attention or quick, concentrated bursts
