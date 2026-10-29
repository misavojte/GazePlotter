# Scanpath

A scanpath shows where one participant looked on a stimulus, and in what order. Each fixation is a circle at its position, sized by its duration, and a line joins consecutive fixations. When the stimulus has [reference media](/docs/workspace/stimuli-library/#reference-media) attached, the image or video is drawn behind the gaze data and its pixel size defines the coordinate space.

![Scanpath card in the workspace: fixations of participant Astrid drawn over a frame of the Promo video stimulus, with the playback bar.](/docs/images/scanpath.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, one participant |
| **Input** | Fixations with X/Y coordinates; the stimulus's reference image or video when attached |
| **Metric Library** | Not used: the plot draws the fixations themselves |

> **Try it**: The [demo workspace](/) opens with the scanpath of participant Astrid over the Promo video, ready to play.

## When to Use It

- **Spatial trajectory**: see where a participant looked and trace the path they took through the stimulus.
- **Duration density**: find regions of sustained visual processing by their larger fixation circles.
- **Gaze over video**: play the scanpath with the video to see what was on screen at each fixation.
- **Stimulus alignment**: with reference media attached, check whether fixations land on the expected regions of the image or video, and correct offsets with the [media alignment](/docs/workspace/stimuli-library/#aligning-media-on-fixations).

## Reading the Plot

- **Axes**: X and Y in gaze coordinates (the media's pixels when it is attached). Y grows downward, as on screen.
- **Circles**: fixations, sized by duration.
- **Color**: by default (**Time gradient**), a fixation's color shows when it began. The key at the bottom right maps the gradient to **Onset** time in seconds.
- **Numbers and lines**: the fixation order. Where labels would overlap, the later fixation keeps its number.
- **Play bar**: below the plot, see [Playback](#playback).

## Add a Scanpath

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/).
2. In the rail on the left, click **Add Visualization**, then **Gaze behavior** > **Scanpath**. When another plot is selected, the new one opens on its stimulus.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** and the **Participant**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Select the stimulus whose gaze data to plot. If the stimulus has reference media attached, it is drawn as the plot background.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to rename stimuli, build stimulus selections, and attach reference media.

### Participant
Select the individual participant whose gaze trajectory you want to visualize. The Scanpath plot displays one participant's scanpath at a time.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename or reorder participants.

### Visualization
- **Fixation color**: **Time gradient** samples each fixation's fill from a color scale by its onset within the shown fixations' time span; **Solid** uses one color, picked below. With **Time gradient**, the color scale picker below sets the gradient stops.
- **Show fixation order line**: Check to render connecting line segments (saccades) between sequential fixations.
- **Show fixation numbers**: Check to print sequence indices (e.g. 1, 2, 3...) next to each fixation circle. Where labels would overlap, the later fixation keeps its number.
- **Playback**:
  - **Trail length (ms)**: During playback, only fixations that began within the last N milliseconds stay on screen, fading as they age. Leave it empty (**All**) to keep everything since the start.
  - **Speed**: Playback rate relative to recording time, from 0.25x to 2x. On a shared clock, the plot that started playback sets the rate.
  - **Play with other plots of this stimulus**: On by default. Every scanpath of the stimulus plays on one shared clock, and its time-axis plots show the playback time. Uncheck to play this plot on its own.

### Time Range
- **Start** / **End (0 = Auto)**: Limits the scanpath to fixations overlapping this recording-time range, in ms. Fixation numbers stay those of the whole recording, and the play bar spans the range.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the 2D scanpath plot as a PNG or JPG. Exports always render the full (parked) scanpath, not a playback frame.
- **Download segments**: Opens the [Segmented Data](/docs/export/segmented-data/) export preset to this plot's stimulus and participant, over whole recordings.

## Playback

A control bar below the plot animates the scanpath over recording time: fixations appear as their onset passes, and each circle inflates over its own dwell. With a video reference medium the video plays in step with the clock, so frames and fixations stay synchronized; set **Video starts at** in the media's settings when the video does not start with the recording.

- **Play / Pause**: Also **Space** while the pointer is over the plot.
- **Show all fixations**: Returns to the full static picture. A finished run holds its last frame until you press it.
- **Seek bar**: The filled part is the trail, the fixations currently on screen. Drag its left edge to change the trail length; drop it at the start for **All**.
- **Time readout**: Seconds with tenths under a minute, minutes and seconds beyond.

### Synchronized time

Scanpaths of a stimulus play on one shared clock, so scanpaths of different participants move in lockstep. While it plays, the [Scarf Plot](/docs/visualizations/scarf-plot) (Absolute timeline), [AOI Timeline](/docs/visualizations/aoi-timeline), and [Metric Timeline](/docs/visualizations/metric-timeline) of the same stimulus show the playback time with the same dashed line they use for hovering, and the scanpath marks the fixation in progress.

Hovering works both ways without playback: hovering a fixation marks its time on those plots, and hovering them marks the fixation in progress at that time on the scanpath.

With **Time gradient** coloring, the colors and the key stay fixed during playback: a fixation's color always means when it began, and opacity shows its age inside the trail.

A compact key at the bottom right of the plot, on the X axis title row, maps the gradient to time: **Onset**, the earliest onset in seconds, the gradient, and the latest. Figure exports include it. On a plot too narrow to fit it beside the axis title, the key is omitted.

## Data Notes

- **Custom CSV time series**: That layout splits rows by AOI changes, so each plotted "fixation" is an AOI run located at its first sample. For a true scanpath, upload a segmented layout with one row per fixation. See [Custom CSV](/docs/upload-data/custom-csv/).

## Related

- [Scarf Plot](/docs/visualizations/scarf-plot/): the AOI sequence of every participant over time, without positions.
- [Fixation Heatmap](/docs/visualizations/fixation-heatmap/): fixations of a participant selection pooled into one map, without order.
- [Scanpath Similarity](/docs/visualizations/scanpath-similarity/): how alike the AOI sequences of participant pairs are.
