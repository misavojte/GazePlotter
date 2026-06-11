# Scarf plot

Scarf plot (or sequential graph) is a visualization of eye movement data that shows the sequence of fixations and saccades in time. It is a useful tool for analyzing the order of fixations and saccades, and for comparing the scanpaths of different participants or stimuli. Specific areas of interest (AOIs) in the given stimuli are color-coded and displayed in the scarf plot. The scarf plot is the main visualization tool in GazePlotter, and it is used to visualize eye-tracking data from various eye-tracking software.

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/basic/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/basic/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/basic/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/basic/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/basic/workspace/#removing-a-plot)

## Overview

The Scarf plot visualization provides a comprehensive chronological view of individual gaze events across groups. It allows for detailed sequential analysis of how individuals visually process stimuli over time.

## Basic Controls

In GazePlotter, scarf plots have the following main controls:

- **[Stimulus](#stimulus)** - a drop-down menu for selecting the stimulus to be analyzed.
- **[Group](#group)** - a drop-down menu for selecting the participant group.
- **[View](#view)** - a drop-down menu for selecting the data representation or aggregation method.
- **[More options](#more-options)** (⋮) - a button for accessing additional customization and export options.

> Note: Zooming controls and a reset view button are also available directly on the header to temporally navigate your scarf plot quickly.

![Scarf plot header with Stimulus, Group, View, and More options controls.](/docs/images/1.png)

### Stimulus

Choose which stimulus to analyze. Each stimulus contains its own set of AOIs that will be displayed in the scarf plot.

### Group

Select participant groups:

- **All participants** - includes data from all participants
- **Custom groups** - analyze specific participant groups created in the grouping interface. See [Participant Groups](/docs/basic/groups/).

### View

The `View` dropdown determines what timeline representation is calculated and displayed. Clicking on a view option opens a settings dialog with customizable parameters for the plot.

#### Absolute time

Displays fixations and events plotted in their exact chronological timing (in milliseconds).

| Parameter          | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Time Range [ms]    | Limit the temporal bounds displayed in the plot (Start / End, where 0 = Auto)                  |
| Hide non-fixations | Toggle visibility of saccades, blinks, and other non-fixation events to declutter the sequence |

![Scarf plot rendered in Absolute time view.](/docs/images/timeline-1.png)

#### Relative time

Displays sequences proportional to the duration of the participant with the longest dwell time for comparability.

| Parameter                       | Description                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Calculated from Time Range [ms] | Limit the temporal range based on absolute time from which relative percentages are formed     |
| Hide non-fixations              | Toggle visibility of saccades, blinks, and other non-fixation events to declutter the sequence |

![Scarf plot rendered in Relative time view.](/docs/images/timeline-2.png)

#### Ordinal time

Displays strict sequential order indices of individual fixations, saccades, and other events, discarding exact durations.

| Parameter               | Description                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Ordinal Range [indices] | Limit the indices sequence displayed in the plot (Start / End, where 0 = Auto)                 |
| Hide non-fixations      | Toggle visibility of saccades, blinks, and other non-fixation events to declutter the sequence |

![Scarf plot rendered in Ordinal time view.](/docs/images/timeline-3.png)

> **Warning**: Some data, e.g. from [OGAMA software](/docs/upload-data/ogama/), support only ordinal time representation.

### More options

The scarf plot menu (⋮) provides quick access to customization and specific features:

#### Customization Options

- **AOI customization** - Modify colors, names, and order of Areas of Interest. See [AOI Customization](/docs/basic/aoi-customization/) for details.
- **Event customization** - Modify event channel names, colors, ordering, and visibility. See [Event Customization](/docs/basic/event-customization/) for details.
- **Stimulus customization** - Manage stimulus properties and settings. See [Stimuli Customization](/docs/basic/stimuli-customization/) for details.
- **Participant customization** - Customize individual participant properties and metadata. See [Participants Customization](/docs/basic/participants-customization/) for details.
- **Setup participants groups** - Create and modify participant groups for comparative analysis. See [Participant Groups](/docs/basic/groups/) for details.

#### Download plot

Export the scarf plot as an image file with customizable settings:

- **File formats**: PNG (recommended, transparent background) or JPG (white background)
- **Dimensions**: Customizable width (height calculated automatically based on content)
- **Quality**: Adjustable DPI setting for screen (96 DPI) or print (300 DPI) use
- **Margins**: Configurable top, right, bottom, left margins (negative values crop the image)
- **Preview**: Live preview of your exported plot before downloading

#### Export Data

Export processed eye-tracking data for external analysis.

This provides access to the raw fixation sequences, timing data, and AOI mappings in CSV format for analysis in R, Python, SPSS, or other statistical software. For detailed information about data export options and formats, see [Segmented Data Export](/docs/export/segmented-data/).

## Interactivity

The scarf plot is interactive. Except for the basic controls and dragging the scarf plot around the workspace, you can interact with the scarf plot to get more detailed information about fixations, saccades, and AOIs in the data or highlight specific segments of the data.

### Sequence details

You can hover over fixations, saccades, and AOIs to see additional information, such as duration, start and end times, and AOI name. This information is displayed in a tooltip when you hover over the corresponding segment.

![Tooltip showing sequence details for a selected scarf plot segment.](/docs/images/4.png)

### Highlighting

In the legend, you can highlight all segments of a specific category (fixations, saccades, or AOIs) by:

1. Hovering over the category name in the legend to highlight all segments of that category temporarily.
2. Clicking on the category name in the legend to highlight all segments of that category until you click on it again to remove the highlight.

![Scarf plot with a highlighted legend category and matching segments.](/docs/images/3.png)

## Event data

GazePlotter supports event data that enriches the scarf plot with additional time-based layers (e.g., dynamic AOI visibility intervals). In **Overlay** mode the AOI gaze sequence sits above a shared baseline, while time-coded events hang below it as colored strips, separated by a small gap so the two layers stay distinct even when they share a color. Each strip spans the full extent of its interval (point events appear as small markers), overlapping events stack into lanes, and a thin gray line divides participants. If the plot is too short to show every row legibly, it asks for more height rather than rendering a cramped figure.

Event files are uploaded together with eye-tracking data files via the **Import** button. For full details on exporting, uploading, and mapping event files, see [Event Data](/docs/upload-data/events/).

To modify event channel names, colors, ordering, or visibility, use **Event customization** from the **More options** (⋮) menu. See [Event Customization](/docs/basic/event-customization/) for details.

> **Note**: Event data is displayed only in **Absolute time** and **Relative time** views. The **Ordinal time** view does not render event channels.

### Interactivity of event data

Each event channel is keyed by colour in the legend. Clicking an event channel in the legend highlights its strips across all participants (and dims the rest), the same way AOI categories are highlighted.
