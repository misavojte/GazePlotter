# Scarf Plot

In eye-tracking research, a scarf plot (also called a sequence chart) shows which Area of Interest (AOI) each participant looked at, and when. Every participant gets one row, time runs from left to right, and every fixation is a band in the color of the AOI it landed on. Read the rows together to see the order in which people work through a stimulus, where they agree, and who behaves differently.

![Scarf Plot card in the workspace: AOI sequences of all participants on the Yarbus Remember clothes stimulus.](/docs/images/scarf-plot.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection |
| **Input** | Fixations, saccades, and other eye-movement segments with their AOI hits; [event data](/docs/upload-data/events/) when the stimulus has it |
| **Metric Library** | Not used: the plot draws the segments themselves |

> **Try it**: The [demo workspace](/) opens with two scarf plots, one on a still image and one on a video with dynamic AOIs.

## When to Use It

- **Order of attention**: which AOI participants visit first, and whether they return to it.
- **Agreement**: a column of one color across many rows means most participants looked at the same AOI at the same moment.
- **Outliers and data quality**: participants who never visit an AOI, end early, or have long gaps where the tracker lost the eyes.
- **Gaze against what was on screen**: with event channels, see whether participants looked at an AOI while it was visible, for example in video.

## Reading the Plot

- **Rows**: one per participant, labeled on the left.
- **Horizontal axis**: elapsed time in milliseconds. *Relative* and *Ordinal* modes change it, see [Timeline mode](#visualization).
- **Tall bands**: fixations, colored by AOI. *No AOI* (gray) is a fixation outside every AOI.
- **Thin lines**: the other eye-movement types, such as saccades and *EyesNotFound*, each in its own shade of gray.
- **Empty space**: no data for that time.
- **Legend**: grouped into **Fixations** (one entry per AOI), **Non-fixations**, and **Event channels**. A time range set in the pane is noted in the axis title, for example *t ≤ 20087 ms*.

## Add a Scarf Plot

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Gaze behavior** > **Scarf Plot**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Each stimulus has its own set of AOIs.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files.

### Participants
Filter the eye-tracking data by a participant selection.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Visualization
Configure the timeline representation mode.
- **Timeline mode**: Choose how the sequence is arrayed along the horizontal axis:
  - *Absolute*: Displays fixations and events plotted in their exact chronological timing (in milliseconds).
  - *Relative*: Stretches each participant's own session to 0 to 100%, so sequences of different lengths line up for comparison.
  - *Ordinal*: Displays strict sequential order indices of individual fixations, saccades, and other events, discarding exact durations.

### Time range / Ordinal range
Defines temporal or index boundaries. The section follows the active timeline mode:
- *Absolute* or *Relative*: **Time range**, with **Start / ms** and **End / ms (0 = Auto)** limiting sequence start and end times.
- *Ordinal*: **Ordinal range**, with **Start** and **End (0 = Auto)** limiting sequence start and end fixation indices.

### Areas of Interest
Narrows which AOIs this plot ranges over.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Eye-movement Types
Narrows which eye-movement types this plot draws. Fixation is one of them: a selection without it hides the fixation layer (the tall AOI bands).
- **Eye-movement type selection**: A dropdown containing *All* and the saved eye-movement type selections. The library ships *Just fixations*, which keeps the fixation layer and drops every other type; a selection with no members draws no gaze at all, leaving an events-only timeline.
- **Edit eye-movement types & selections**: Opens the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) to customize classification categories and selections.

### Events
Narrows which event channels this plot draws under each row, in *Absolute* and *Relative* modes, whenever the stimulus has event data.
- **Event selection**: A dropdown containing *All* and the saved event selections (matched by displayed channel name, portable across stimuli). The library ships *No events*, which holds no channels, so picking it hides the event strips.
- **Edit events & selections**: Opens the [Event Library](/docs/workspace/event-library/) to customize event names, colors, ordering, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the scarf plot as a PNG or JPG.
- **Download segments**: Opens the [Segmented Data](/docs/export/segmented-data/) export preset to this plot's stimulus, participant selection and AOI selection, over whole recordings.

## Interactivity

- **Sequence details**: Hovering over any fixation, saccade, or event strip displays a tooltip with details (e.g. duration, start/end times, and AOI or event name).
- **Highlighting**: Hovering over a category (fixation, saccade, or specific AOI/event channel) in the legend temporarily highlights all matching segments across all participants and dims the rest. Clicking a legend category toggles a persistent highlight.
- **Linked hovering**: The hovered moment and participant are marked in the other plots of the workspace, see [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).

## Event Channels and Dynamic AOIs

When the stimulus has [event data](/docs/upload-data/events/), such as the visibility intervals of dynamic AOIs in a video, each event channel runs as a colored strip under every participant's gaze row. Overlapping events stack into lanes, and a thin gray line divides participants. Event strips are drawn only in *Absolute* and *Relative* modes.

![Scarf Plot of the Promo video stimulus with dynamic AOIs: the visibility interval of each AOI runs as an event channel strip under every participant row.](/docs/images/scarf-plot-events.webp)

## Related

- [Scanpath](/docs/visualizations/scanpath/): the same fixations drawn over the stimulus, for one participant.
- [AOI Timeline](/docs/visualizations/aoi-timeline/): how attention is split between AOIs over time, pooled across participants.
- [Transition Matrix](/docs/visualizations/transition-matrix/): how often gaze moves from one AOI to another.
- [Scanpath Similarity](/docs/visualizations/scanpath-similarity/): how alike the AOI sequences of participant pairs are.
