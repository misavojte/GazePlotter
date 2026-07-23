# Scanpath

The Scanpath plot provides a 2D spatial visualization of a participant's gaze trajectory directly overlaid on top of the stimulus image. It displays fixations as circles (where the circle's radius corresponds to the fixation duration) and saccades as connecting lines, mapping the exact sequence of visual attention.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

- **Metric Contract**: This visualization renders spatial coordinates directly and does not consume metrics from the Metric Library.

## Configuration via Pane

Clicking the Scanpath plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Select the stimulus on which to overlay the scanpath. The stimulus dimensions and image will serve as the background for the 2D coordinate plot.
- **Edit stimuli & selections…**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participant
Select the individual participant whose gaze trajectory you want to visualize. The Scanpath plot displays one participant's scanpath at a time.
- **Edit participants…**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename or reorder participants.

### Display
Configure the visual annotations rendered on the spatial overlay.
- **Show fixation order line**: Check to render connecting line segments (saccades) between sequential fixations.
- **Show fixation numbers**: Check to print sequence indices (e.g. 1, 2, 3...) inside each fixation circle to show the progression order.

### Areas of Interest
Filters which Areas of Interest (AOIs) are overlaid on the stimulus. AOIs are rendered as translucent colored shapes on top of the background.
- **Configure AOI Library…**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, and shapes.

### Export
Located at the bottom of the Pane:
- **Download plot…**: Opens the [Figure Export](/docs/export/figures/) dialog to save the 2D scanpath plot as a PNG or JPG.

## Interpretation

Use the Scanpath plot to:
- **Analyze spatial trajectory**: See exactly where a participant looked and trace the path they took through the stimulus.
- **Observe duration density**: Identify regions of sustained visual processing based on larger fixation circles.
- **Verify AOI alignment**: Check if a participant's fixations landed precisely within target boundaries or hovered around edges.