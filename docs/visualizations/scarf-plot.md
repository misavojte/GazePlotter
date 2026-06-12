# Scarf Plot

The Scarf Plot (or sequential graph) is a chronological visualization of eye movement data showing the sequence of fixations and saccades over time. Specific Areas of Interest (AOIs) in the stimulus are color-coded and displayed as contiguous horizontal strips. It is the primary visualization for detailed sequential analysis of visual search and scanpaths across participants or stimuli.

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/setup/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/setup/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/setup/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/setup/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/setup/workspace/#removing-a-plot)

## Metric Contract

- **Metric Contract**: This visualization renders eye-tracking sequences directly and does not consume metrics from the Metric Library.

## Configuration via Settings Pane

Clicking the Scarf Plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed in the scarf plot.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and dimensions.

### Participant group
Filter the eye-tracking data by group.
- **Select group**: A dropdown containing *All participants* and custom participant groups.
- **Edit groups…**: Opens the Participant Groups modal to create or modify comparative groups.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

### Visualisation
Configure the timeline representation mode, event layers, and data visibility.
- **Timeline mode**: Choose how the sequence is arrayed along the horizontal axis:
  - *Absolute*: Displays fixations and events plotted in their exact chronological timing (in milliseconds).
  - *Relative*: Scales and displays sequences proportional to the participant with the longest dwell time for cross-participant comparability.
  - *Ordinal*: Displays strict sequential order indices of individual fixations, saccades, and other events, discarding exact durations.
- **Event display** (visible only in *Absolute* and *Relative* modes, and if the selected stimulus has event data):
  - *None*: Hides event strips and displays only the AOI gaze sequences.
  - *Overlay*: The gaze sequence is displayed above a baseline, and time-coded event channels are rendered below it as colored strips.
  - *Only events*: Hides the gaze sequences entirely, displaying only the event channel strips.
- **Hide data**: 
  - *Non-fixations* (visible in *Ordinal* mode, or if event display is not *Only events*): When checked, saccades, blinks, and other non-fixation events are hidden to declutter the visual scanpath sequence.

### Time range [ms] / Ordinal range [indices]
Defines temporal or index boundaries. GazePlotter automatically matches this section to the active timeline mode:
- **Time range [ms]** (in *Absolute* or *Relative* mode): Limit sequence start and end times (ms) (*0 = Auto*).
- **Ordinal range [indices]** (in *Ordinal* mode): Limit sequence by start and end fixation indices (*0 = Auto*).

### Areas of Interest
Filters which Areas of Interest (AOIs) are active and color-coded.
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, rename, or color-code AOIs.

### Eye-movement Type
Configure classification categories (e.g. Saccades, Blinks, Fixations).
- **Configure Category Library…**: Opens the Category Modification modal to edit display names, colors, and global visibility of classification states.

### Events
Configure event channels mapped to the stimulus.
- **Configure Event Library…**: Opens the Event Channel Modification modal to edit event names, colors, display ordering, and visibility.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the plot.
  - *File formats*: PNG (recommended, transparent background) or JPG (white background).
  - *Dimensions*: Customizable width (height calculated automatically based on content and number of participants).
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable margins.
  - *Preview*: Live render of the output before saving.
- **Export Data**: To export raw fixation sequences, timing, and AOI mapping data in CSV format, see the [Segmented Data Export](/docs/export/segmented-data/) documentation.

## Interactivity

The scarf plot is highly interactive:
- **Sequence details**: Hovering over any fixation, saccade, or event strip displays a tooltip with details (e.g. duration, start/end times, and AOI or event name).
- **Highlighting**: Hovering over a category (fixation, saccade, or specific AOI/event channel) in the legend temporarily highlights all matching segments across all participants and dims the rest. Clicking a legend category toggles a persistent highlight.

## Event Data Layer

GazePlotter supports event data (e.g., dynamic AOI visibility intervals) displayed under the participant gaze sequence. In **Overlay** mode, time-coded events hang below a shared baseline as colored strips. Overlapping events stack into lanes, and a thin gray line divides participants. Event data is displayed only in **Absolute** and **Relative** time views.
