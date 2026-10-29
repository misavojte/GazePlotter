# Event Comparison

Event Comparison puts one metric side by side for every event channel on a stimulus: dynamic AOI visibility periods, task markers, derived interval channels, or whatever the uploaded [event data](/docs/upload-data/events/) carries. It answers questions about what happened around the gaze ("how long was this dynamic AOI on screen, per participant?") rather than questions about the gaze itself, which is what [AOI Comparison](/docs/visualizations/aoi-comparison/) and [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison/) answer.

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection |
| **Input** | One per-channel metric over the stimulus's [event data](/docs/upload-data/events/), computed over the selected time range |
| **Metric Library** | Used: any per-channel (`event-vector`) metric that is not windowed; *Event duration* by default |

The plot is offered only when the loaded dataset contains event data, since without it there is no axis to draw.

## When to Use It

- **Profile the stimulus timeline**: Read how long each dynamic AOI was visible, or how often each marker fired, per participant.
- **Check event coverage**: A channel whose time share sits far below expectation, or whose count varies wildly across participants, usually signals a mapping or recording problem rather than behaviour.
- **Compare cohorts**: Put two plots side by side with different participant selections to contrast their event exposure.
- **Watch for overlap**: A time share above 100 means occurrences on that channel overlap (often channels merged under one name); the reading is honest, not an error.

## Reading the Plot

- **Rows**: one per event channel (columns in *Vertical* orientation), in the stimulus's channel order by default. See [The Channel Axis](#the-channel-axis).
- **Dots**: what a single dot is depends on the metric. Metrics measured per occurrence, such as *Event duration*, plot every occurrence as its own dot, so a channel's spread is the spread of its occurrence lengths. The rest plot one dot per participant.
- **Overlay**: the black tick is the mean, and the whiskers show its 95% confidence interval by default. **Statistical overlay** switches to standard deviation or a box plot.
- **Value axis**: the metric and its unit, followed by the statistic of the overlay, for example *Event duration / ms · mean ± 95% CI*. A time range set in the pane is noted there too.

## Add an Event Comparison

1. Load your data, including its [event data](/docs/upload-data/events/): drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Per event** > **Event Comparison**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick a **Stimulus** that has event channels, then the metric under **Metric**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Event channels are defined per stimulus, so this also picks the channel axis.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by group or individual participant.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric displayed on the value axis. For how these values are calculated, see [Event Metrics](/docs/metrics/events/).
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `event-vector` shape contract (one value per event channel) and are not windowed (one aggregate over the selected time range). Individual values are pooled per channel rather than reduced to one number. The library ships five, all documented in [Event Metrics](/docs/metrics/events/):
  - *Event time* (`eventTime`): Total time each channel is active (ms).
  - *Event time share* (`eventTimeShare`): Share of the recording or bounded range each channel is active (%).
  - *Event duration* (`eventDuration`): Length of the individual occurrences on each channel (ms). This is the default.
  - *Event count* (`eventCount`): Number of occurrences active on each channel within the analyzed range, instant markers included.
  - *Time to first event* (`eventLatency`): Elapsed time from the start of the stimulus timeline to the first occurrence on each channel (ms).
- **Edit metric library**: Opens the Metric Library modal where you can customize parameters or define new **custom metrics** on the event axis.

The plot draws the instance's whole vector at its identity projection. Reducing an instance to a single channel is a `pick-event` projection, which turns it into a scalar and moves it to the scalar plots ([Metric Correlation](/docs/visualizations/metric-correlation/), [Metric Matrix](/docs/visualizations/metric-matrix/), [Metric Timeline](/docs/visualizations/metric-timeline/)); it is never a setting on this plot.

### Visualization
Configure the layout and the statistical summary.
- **Statistical overlay**: The summary drawn over the dots:
  - *None*: Shows only the dots.
  - *Mean ± 95% CI*: The mean with whiskers for its 95% confidence interval (default).
  - *Mean ± SD*: The mean with whiskers for one standard deviation.
  - *Boxplot*: The median, a box from the first to the third quartile, and whiskers to the furthest values within 1.5 × IQR.
- **Orientation**: Select *Horizontal* (default) or *Vertical* layout.
- **Order by**: Sort slots by *Value* or by *Channel order* (the library's order, default).
- **Direction**: Sort *Ascending* or *Descending*.
- **Scale range**: Explicitly set the value axis minimum and maximum (*0 = Auto*).

### Time range
Filter the temporal range from which occurrences are fetched.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

Note that *Time to first event* does not re-zero its clock to the range start: the first in-range occurrence reports its true onset.

### Events
Filters which event channels are drawn.
- **Event selection**: A dropdown containing *All* and the saved event selections, including the shipped *No events*.
- **Edit events & selections**: Opens the [Event Library](/docs/workspace/event-library/) to rename, recolor, merge, derive interval channels, and build selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the plot as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection and time range.
- For the raw event occurrences behind the plot, use [Event Data Export](/docs/export/event-data/) from the header's **Export** menu.

## Interactivity

- **Tooltip**: Hovering a row shows the channel and the axis value at the pointer. Over dots it lists the participants there (with a count when one participant has several dots); elsewhere in the row it shows n, mean, median, SD, and the 95% CI.

## The Channel Axis

Slots come from the [Event Library](/docs/workspace/event-library/) in the selected stimulus's channel order, one slot per displayed name. Two consequences follow from that:

- Channels merged under one displayed name are measured as one slot, not summed after the fact.
- Channels are defined per stimulus, so switching the stimulus can change the axis. A channel present on one stimulus and absent on another simply has no slot there.

The plot's **Events** selection narrows which slots are drawn. The library ships a *No events* selection, which holds no channels and empties the plot; event selections are name-keyed, so they are portable across stimuli.

## Related

- [AOI Comparison](/docs/visualizations/aoi-comparison/): the same plot along AOIs.
- [Eye-movement Comparison](/docs/visualizations/eye-movement-comparison/): the same plot along eye-movement types.
- [Scarf Plot](/docs/visualizations/scarf-plot/#event-channels-and-dynamic-aois): event channels drawn as strips under each participant's gaze sequence.
