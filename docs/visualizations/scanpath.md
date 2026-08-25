# Scanpath

The Scanpath plot provides a 2D spatial visualization of a participant's gaze trajectory. It displays fixations as circles (where the circle's radius corresponds to the fixation duration) and saccades as connecting lines, mapping the exact sequence of visual attention. When the stimulus has [reference media](/docs/workspace/stimuli-library/#reference-media) attached, the image or video is drawn behind the gaze data and its pixel size defines the coordinate space.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

- **Metric Contract**: This visualization renders spatial coordinates directly and does not consume metrics from the Metric Library.

## Configuration via Pane

Clicking the Scanpath plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Select the stimulus whose gaze data to plot. If the stimulus has reference media attached, it is drawn as the plot background.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to rename stimuli, build stimulus selections, and attach reference media.

### Participant
Select the individual participant whose gaze trajectory you want to visualize. The Scanpath plot displays one participant's scanpath at a time.
- **Edit participants…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename or reorder participants.

### Visualisation
- **Fixation color**: **Time gradient** samples each fixation's fill from a color scale by its onset within the shown time span; **Solid** uses one fixed color. With **Time gradient**, the color scale picker below sets the gradient stops.
- **Show fixation order line**: Check to render connecting line segments (saccades) between sequential fixations.
- **Show fixation numbers**: Check to print sequence indices (e.g. 1, 2, 3...) next to each fixation circle to show the progression order.
- **Playback**:
  - **Window (ms, 0 shows all)**: During playback, only fixations that began within the last N milliseconds stay on screen, so the scanpath scrolls as a trailing window. 0 keeps everything since the start.
  - **Speed**: Playback rate relative to recording time, from 0.25x to 2x. With a video background this sets the video's playback rate, keeping frames and fixations in sync.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the 2D scanpath plot as a PNG or JPG. Exports always render the full (parked) scanpath, not a playback frame.

## Playback

A control bar below the plot animates the scanpath over recording time: fixations appear as their onset passes, and each circle inflates over its own dwell. With a video reference medium the video is the clock, so frames and fixations stay synchronized; otherwise an internal clock runs over the fixations' time extent. Use the seek bar to scrub, and the time readout to track the position. When a run completes, the plot parks back on the full static picture.

With **Time gradient** coloring, the gradient continuously rescales to the shown time span during playback: a fixation enters at the newest end of the scale and smoothly ages toward the oldest end as time passes.

## Interpretation

Use the Scanpath plot to:
- **Analyze spatial trajectory**: See exactly where a participant looked and trace the path they took through the stimulus.
- **Observe duration density**: Identify regions of sustained visual processing based on larger fixation circles.
- **Verify stimulus alignment**: With reference media attached, check whether fixations land on the expected regions of the image or video, and correct offsets via the media's position mapping.