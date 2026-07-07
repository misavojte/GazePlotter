# Scarf Plot

The Scarf Plot (or sequential graph) is a chronological visualization of eye movement data showing the sequence of fixations and saccades over time. Specific Areas of Interest (AOIs) in the stimulus are color-coded and displayed as contiguous horizontal strips. It is the primary visualization for detailed sequential analysis of visual search and scanpaths across participants or stimuli.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

- **Metric Contract**: This visualization renders eye-tracking sequences directly and does not consume metrics from the Metric Library.

## Configuration via Pane

Clicking the Scarf Plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Each stimulus contains its own set of Areas of Interest (AOIs) which will be displayed in the scarf plot.
- **Edit stimulus library…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files.

### Participant group
Filter the eye-tracking data by group.
- **Select group**: A dropdown containing *All participants* and custom participant groups.
- **Edit groups…**: Opens the [Participant Groups](/docs/workspace/participant-groups/) editor to manage cohort comparison sets.
- **Edit participants…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename or reorder participants.

### Visualisation
Configure the timeline representation mode, event layers, and data visibility.
- **Timeline mode**: Choose how the sequence is arrayed along the horizontal axis:
  - *Absolute*: Displays fixations and events plotted in their exact chronological timing (in milliseconds).
  - *Relative*: Scales and displays sequences proportional to the participant with the longest dwell time for cross-participant comparability.
  - *Ordinal*: Displays strict sequential order indices of individual fixations, saccades, and other events, discarding exact durations.
- **Hide data**: Toggle secondary layers off to declutter the sequence. Event channels always render as an overlay — time-coded colored strips below each participant's gaze baseline — whenever the stimulus has event data; the *Events* toggle hides that overlay.
  - *Non-fixations* (visible when the data contains segments): When checked, saccades, blinks, and other non-fixation segments are hidden to declutter the visual scanpath sequence.
  - *Events* (visible in *Absolute* and *Relative* modes when the selected stimulus has event data): When checked, the event overlay is hidden. Events are shown by default.

### Time range [ms] / Ordinal range [indices]
Defines temporal or index boundaries. GazePlotter automatically matches this section to the active timeline mode:
- **Time range [ms]** (in *Absolute* or *Relative* mode): Limit sequence start and end times (ms) (*0 = Auto*).
- **Ordinal range [indices]** (in *Ordinal* mode): Limit sequence by start and end fixation indices (*0 = Auto*).

### Areas of Interest
Filters which Areas of Interest (AOIs) are active and color-coded.
- **Configure AOI Library…**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, and visibility.

### Eye-movement Type
Configure classification categories (e.g. Saccades, Blinks, Fixations).
- **Configure Category Library…**: Opens the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) to customize classification categories.

### Events
Configure event channels mapped to the stimulus.
- **Configure Event Library…**: Opens the [Event Library](/docs/workspace/event-library/) to customize event names, colors, and ordering.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the scarf plot as a PNG or JPG.
- **Export Data**: To export raw fixation sequences, timing, and AOI mapping data as CSV, see [Segmented Data Export](/docs/export/segmented-data/).

## Interactivity

The scarf plot is highly interactive:
- **Sequence details**: Hovering over any fixation, saccade, or event strip displays a tooltip with details (e.g. duration, start/end times, and AOI or event name).
- **Highlighting**: Hovering over a category (fixation, saccade, or specific AOI/event channel) in the legend temporarily highlights all matching segments across all participants and dims the rest. Clicking a legend category toggles a persistent highlight.

## Event Data Layer

GazePlotter supports event data (e.g., dynamic AOI visibility intervals) displayed under the participant gaze sequence. In **Overlay** mode, time-coded events hang below a shared baseline as colored strips. Overlapping events stack into lanes, and a thin gray line divides participants. Event data is displayed only in **Absolute** and **Relative** time views.