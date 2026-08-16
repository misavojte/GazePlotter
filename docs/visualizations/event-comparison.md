# Event Comparison

Event Comparison quantifies the recording along its event axis: one distribution per event channel (dynamic AOI visibility periods, task markers, derived interval channels, or whatever the uploaded [event data](/docs/upload-data/events/) carries), compared side by side for the selected participants. It answers questions about what happened around the gaze ("how long was this dynamic AOI on screen, per participant?") rather than questions about the gaze itself, which is what [AOI Comparison](/docs/visualizations/aoi-comparison/) and [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison/) answer.

The plot is offered only when the loaded dataset contains event data, since without it there is no axis to draw.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## The Channel Axis

Slots come from the [Event Library](/docs/workspace/event-library/) in the selected stimulus's channel order, one slot per displayed name. Two consequences follow from that:

- Channels merged under one displayed name are measured as one slot, not summed after the fact.
- Channels are defined per stimulus, so switching the stimulus can change the axis. A channel present on one stimulus and absent on another simply has no slot there.

The plot's **Events** selection narrows which slots are drawn. The library ships a *No events* selection, which holds no channels and empties the plot; event selections are name-keyed, so they are portable across stimuli.

## Metric Contract

To render an Event Comparison plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `event-vector` (computes a value for each event channel individually).
- **Windowing**: `forbidden` (calculated across the selected time range as a single aggregate).
- **Cross-participant treatment**: distribution (individual values are pooled per channel rather than reduced to one number).

The plot draws the instance's whole vector at its identity projection. Reducing an instance to a single channel is a `pick-event` projection, which turns it into a scalar and moves it to the scalar plots ([Metric Correlation](/docs/visualizations/metric-correlation/), [Metric Matrix](/docs/visualizations/metric-matrix/), [Metric Timeline](/docs/visualizations/metric-timeline/)); it is never a setting on this plot.

> **Metrics Documentation**: For how these raw values are calculated, see [Event Metrics](/docs/metrics/events/).

## Configuration via Pane

Clicking the Event Comparison plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Event channels are defined per stimulus, so this also picks the channel axis.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by group or individual participant.
- **Participant selection**: A dropdown containing *All*, *Non-empty*, and saved participant selections.
- **Edit participants & selections…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric displayed on the value axis.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `event-vector` shape contract. The library ships five, all documented in [Event Metrics](/docs/metrics/events/):
  - *Event time* (`eventTime`): Total time each channel is active (ms).
  - *Event time share* (`eventTimeShare`): Share of the recording or bounded range each channel is active (%).
  - *Event duration* (`eventDuration`): Length of the individual occurrences on each channel (ms). This is the default.
  - *Event count* (`eventCount`): Number of occurrences active on each channel within the analyzed range, instant markers included.
  - *Time to first event* (`eventLatency`): Elapsed time from the start of the stimulus timeline to the first occurrence on each channel (ms).
- **Edit metric library…**: Opens the Metric Library modal where you can customize parameters or define new **custom metrics** on the event axis.

### Visualisation
Configure the layout and rendering of the distributions.
- **Statistical overlay**: Render a statistical summary over the individual values:
  - *None*: Shows only the mean bars and the individual values.
  - *Mean ± 95% CI*: Draws error bars showing the 95% Confidence Interval.
  - *Mean ± SD*: Draws error bars showing the Standard Deviation.
  - *Boxplot*: Overlays a standard box-and-whisker plot mapping the quartile distribution.
- **Orientation**: Select *Horizontal* (default) or *Vertical* layout.
- **Order by**: Sort slots by *Value* or by *Channel order* (the library's order).
- **Direction**: Sort ascending (*ASC*) or descending (*DESC*).
- **Scale range**: Explicitly set the value axis minimum and maximum (*0 = Auto*).

What a single dot is depends on the metric. Metrics measured per occurrence, such as *Event duration*, plot every occurrence as its own dot, so a channel's spread is the spread of its occurrence lengths. The rest plot one dot per participant. Either way the bar is the mean of the drawn values, and the value axis label states the statistic the overlay summarizes.

### Time range [ms]
Filter the temporal range from which occurrences are fetched.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

Note that *Time to first event* does not re-zero its clock to the range start: the first in-range occurrence reports its true onset.

### Events
Filters which event channels are drawn.
- **Event selection**: A dropdown containing *All* and the saved event selections, including the shipped *No events*.
- **Edit events & selections…**: Opens the [Event Library](/docs/workspace/event-library/) to rename, recolor, merge, derive interval channels, and build selections.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the plot as a PNG or JPG.
- **Export Data**: To export the raw event occurrences as CSV, see [Event Data Export](/docs/export/event-data/).

## Interpretation

Use Event Comparison to:
- **Profile the stimulus timeline**: Read how long each dynamic AOI was visible, or how often each marker fired, per participant.
- **Check event coverage**: A channel whose time share sits far below expectation, or whose count varies wildly across participants, usually signals a mapping or recording problem rather than behaviour.
- **Compare cohorts**: Put two plots side by side with different participant selections to contrast their event exposure.
- **Watch for overlap**: A time share above 100 means occurrences on that channel overlap (often channels merged under one name); the reading is honest, not an error.
