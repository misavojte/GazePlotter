# Eye-movement Comparison

Eye-movement Comparison quantifies the recording along its eye-movement type axis instead of its AOI axis: one distribution per type (fixations, saccades, blinks, or whatever else the source recorded), compared side by side for the selected participants. It answers questions of oculomotor behaviour ("how much of this trial was spent in saccades?") rather than questions of spatial attention ("which region drew the most dwell time?"), which is what [AOI Comparison](/docs/visualizations/aoi-comparison/) answers.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## The Type Axis

Slots come from the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) in its canonical order, one slot per displayed name. Two consequences follow from that:

- Types merged under one displayed name are measured as one slot, not summed after the fact.
- A dataset only carries the types its source recorded. Fixation-only exports (GazePoint, plain CSV fixation lists) have no Saccade slot at all, so a saccade reading reports no value rather than an approximation.

The plot's **Eye-movement Types** selection narrows which slots are drawn. The library ships a *Just fixations* selection, which narrows the axis to the Fixation slot and drops every other type.

## Metric Contract

To render an Eye-movement Comparison plot, GazePlotter queries the workspace's metric library. This visualization requires a metric configuration that satisfies the following contract:

- **Output Shape**: `category-vector` (computes a value for each eye-movement type individually).
- **Windowing**: `forbidden` (calculated across the selected time range as a single aggregate).
- **Cross-participant treatment**: distribution (individual values are pooled per type rather than reduced to one number).

The plot draws the instance's whole vector at its identity projection. Reducing an instance to a single type is a `pick-category` projection, which turns it into a scalar and moves it to the scalar plots ([Metric Correlation](/docs/visualizations/metric-correlation/), [Metric Matrix](/docs/visualizations/metric-matrix/), [Metric Timeline](/docs/visualizations/metric-timeline/)); it is never a setting on this plot.

> **Metrics Documentation**: For how these raw values are calculated, see [Eye-movement Type Metrics](/docs/metrics/eye-movement/).

## Configuration via Pane

Clicking the Eye-movement Comparison plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Choose the stimulus to analyze. Eye-movement types are dataset-wide, but the segments measured are those recorded on this stimulus.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participants
Filter the eye-tracking data by group or individual participant.
- **Participant selection**: A dropdown containing *All*, *Non-empty*, and saved participant selections.
- **Edit participants & selections…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename, merge, and build [participant selections](/docs/workspace/participant-library/#participant-selections).

### Metric
Configure the quantitative metric displayed on the value axis.
- **Select metric**: A dropdown of all metric instances in the library that satisfy the `category-vector` shape contract. The library ships five, all documented in [Eye-movement Type Metrics](/docs/metrics/eye-movement/):
  - *Eye-movement time* (`movementTime`): Total time spent in segments of each type (ms).
  - *Eye-movement time share* (`movementTimeShare`): Share of the recording or bounded range spent in each type (%).
  - *Eye-movement duration* (`movementDuration`): Length of the individual segments of each type (ms). This is the default.
  - *Eye-movement count* (`movementCount`): Number of segments of each type.
  - *Time to first eye movement* (`movementLatency`): Elapsed time from the start of the stimulus timeline to the first segment of each type (ms). Read at the Saccade slot this is saccadic latency.
- **Edit metric library…**: Opens the Metric Library modal where you can customize parameters or define new **custom metrics** on the type axis.

### Visualisation
Configure the layout and rendering of the distributions.
- **Statistical overlay**: Render a statistical summary over the individual values:
  - *None*: Shows only the mean bars and the individual values.
  - *Mean ± 95% CI*: Draws error bars showing the 95% Confidence Interval.
  - *Mean ± SD*: Draws error bars showing the Standard Deviation.
  - *Boxplot*: Overlays a standard box-and-whisker plot mapping the quartile distribution.
- **Orientation**: Select *Horizontal* (default) or *Vertical* layout.
- **Order by**: Sort slots by *Value* or by *Type order* (the library's order).
- **Direction**: Sort ascending (*ASC*) or descending (*DESC*).
- **Scale range**: Explicitly set the value axis minimum and maximum (*0 = Auto*).

What a single dot is depends on the metric. Metrics measured per event, such as *Eye-movement duration*, plot every segment as its own dot, so a type's spread is the spread of its segment lengths. The rest plot one dot per participant. Either way the bar is the mean of the drawn values, and the value axis label states the statistic the overlay summarizes.

### Time range [ms]
Filter the temporal range from which segments are fetched.
- **Start**: Limit the minimum time boundary (ms).
- **End (0 = Auto)**: Limit the maximum time boundary (ms) or leave at 0 for automatic duration matching.

Note that *Time to first eye movement* does not re-zero its clock to the range start: the first in-range segment of a type reports its true onset.

### Eye-movement Types
Filters which eye-movement types are drawn.
- **Eye-movement type selection**: A dropdown containing *All* and the saved eye-movement type selections, including the shipped *Just fixations*.
- **Edit eye-movement types & selections…**: Opens the [Eye-movement Type Library](/docs/workspace/eye-movement-type-library/) to rename, recolor, merge, and build selections.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the plot as a PNG or JPG.
- **Export Data**: To export the computed values as CSV, see [Metric Data Export](/docs/export/metric-data/).

## Interpretation

Use Eye-movement Comparison to:
- **Profile oculomotor behaviour**: Read the time budget across fixations, saccades, and blinks for a condition or a cohort.
- **Compare cohorts**: Put two plots side by side with different participant selections to contrast their type distributions.
- **Judge scanning effort**: Saccade count and saccade time index scanning effort; fixation duration indexes processing depth.
- **Screen latency distributions**: Saccadic latency is right-skewed, so prefer the *Boxplot* overlay (median and IQR) over a mean when comparing groups.
- **Check data provenance**: A type that reads flat or empty across every participant usually means the source never classified it, not that the behaviour is absent.
