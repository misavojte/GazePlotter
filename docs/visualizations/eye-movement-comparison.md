# Eye-movement Comparison

Eye-movement Comparison puts one metric side by side for every eye-movement type in the recording: fixations, saccades, blinks, or whatever else the source classified. It answers questions of oculomotor behaviour ("how much of this trial was spent in saccades?") rather than questions of spatial attention ("which region drew the most dwell time?"), which is what [AOI Comparison](/docs/visualizations/aoi-comparison/) answers.

![Eye-movement Comparison card in the workspace: duration of fixations, saccades and other eye-movement types on the Yarbus Remember clothes stimulus.](/docs/images/eye-movement-comparison.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, any participant selection |
| **Input** | One per-type metric, computed over the selected time range |
| **Metric Library** | Used: any per-type (`category-vector`) metric that is not windowed; *Eye-movement duration* by default |

## When to Use It

- **Profile oculomotor behaviour**: Read the time budget across fixations, saccades, and blinks for a condition or a cohort.
- **Compare cohorts**: Put two plots side by side with different participant selections to contrast their type distributions.
- **Judge scanning effort**: Saccade count and saccade time index scanning effort; fixation duration indexes processing depth.
- **Screen latency distributions**: Saccadic latency is right-skewed, so prefer the *Boxplot* overlay (median and IQR) over a mean when comparing groups.
- **Check data provenance**: A type that reads flat or empty across every participant usually means the source never classified it, not that the behaviour is absent.

## Reading the Plot

- **Rows**: one per eye-movement type (columns in *Vertical* orientation), in the order of the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) by default. See [The Type Axis](#the-type-axis).
- **Dots**: what a single dot is depends on the metric. Metrics measured per event, such as *Eye-movement duration*, plot every segment as its own dot, so a type's spread is the spread of its segment lengths. The rest plot one dot per participant.
- **Overlay**: the black tick is the mean, and the whiskers show its 95% confidence interval by default. **Statistical overlay** switches to standard deviation or a box plot.
- **Value axis**: the metric and its unit, followed by the statistic of the overlay, for example *Eye-movement duration / ms · mean ± 95% CI*. A time range set in the pane is noted there too.

## Add an Eye-movement Comparison

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Gaze behavior** > **Eye-movement Comparison**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus**, then the metric under **Metric**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Eye-movement types are dataset-wide, but the segments measured are those recorded on this stimulus.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by group or individual participant.
- **Participant selection**: *All* or a saved participant selection. **Hide participants without data** leaves out those with no recording on the stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric displayed on the value axis. For how these values are calculated, see [Eye-movement Type Metrics](/docs/metrics/eye-movement/).
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `category-vector` shape contract (one value per eye-movement type) and are not windowed (one aggregate over the selected time range). Individual values are pooled per type rather than reduced to one number. The library ships five, all documented in [Eye-movement Type Metrics](/docs/metrics/eye-movement/):
  - *Eye-movement time* (`movementTime`): Total time spent in segments of each type (ms).
  - *Eye-movement time share* (`movementTimeShare`): Share of the recording or bounded range spent in each type (%).
  - *Eye-movement duration* (`movementDuration`): Length of the individual segments of each type (ms). This is the default.
  - *Eye-movement count* (`movementCount`): Number of segments of each type.
  - *Time to first eye movement* (`movementLatency`): Elapsed time from the start of the stimulus timeline to the first segment of each type (ms). Read at the Saccade slot this is saccadic latency.
- **Edit metric library**: Opens the Metric Library modal where you can customize parameters or define new **custom metrics** on the type axis.

The plot draws the instance's whole vector at its identity projection. Reducing an instance to a single type is a `pick-category` projection, which turns it into a scalar and moves it to the scalar plots ([Metric Correlation](/docs/visualizations/metric-correlation/), [Metric Matrix](/docs/visualizations/metric-matrix/), [Metric Timeline](/docs/visualizations/metric-timeline/)); it is never a setting on this plot.

### Visualization
Configure the layout and the statistical summary.
- **Statistical overlay**: The summary drawn over the dots:
  - *None*: Shows only the dots.
  - *Mean ± 95% CI*: The mean with whiskers for its 95% confidence interval (default).
  - *Mean ± SD*: The mean with whiskers for one standard deviation.
  - *Boxplot*: The median, a box from the first to the third quartile, and whiskers to the furthest values within 1.5 × IQR.
- **Orientation**: Select *Horizontal* (default) or *Vertical* layout.
- **Order by**: Sort slots by *Value* or by *Type order* (the library's order, default).
- **Direction**: Sort *Ascending* or *Descending*.
- **Scale range**: Explicitly set the value axis minimum and maximum (*0 = Auto*).

### Time range
Filter the temporal range from which segments are fetched.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

Note that *Time to first eye movement* does not re-zero its clock to the range start: the first in-range segment of a type reports its true onset.

### Eye-movement Types
Filters which eye-movement types are drawn.
- **Eye-movement type selection**: A dropdown containing *All* and the saved eye-movement type selections, including the shipped *Just fixations*.
- **Edit eye-movement types & selections**: Opens the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) to rename, recolor, merge, and build selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the plot as a PNG or JPG.
- **Download data**: Opens the [Metric Data](/docs/export/metric-data/) export preset to this plot's metrics, stimulus, participant selection and time range.

## Interactivity

- **Tooltip**: Hovering a row shows the type and the axis value at the pointer. Over dots it lists the participants there (with a count when one participant has several dots); elsewhere in the row it shows n, mean, median, SD, and the 95% CI.

## The Type Axis

Slots come from the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) in its canonical order, one slot per displayed name. Two consequences follow from that:

- Types merged under one displayed name are measured as one slot, not summed after the fact.
- A dataset only carries the types its source recorded. Fixation-only exports (GazePoint, plain CSV fixation lists) have no Saccade slot at all, so a saccade reading reports no value rather than an approximation.

The plot's **Eye-movement Types** selection narrows which slots are drawn. The library ships a *Just fixations* selection, which narrows the axis to the Fixation slot and drops every other type.

## Related

- [AOI Comparison](/docs/visualizations/aoi-comparison/): the same plot along AOIs, for questions of spatial attention.
- [Event Comparison](/docs/visualizations/event-comparison/): the same plot along event channels.
- [Scarf Plot](/docs/visualizations/scarf-plot/): fixations and the other eye-movement types in sequence, participant by participant.
