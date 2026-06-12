# Scanpath Plot

The Scanpath Plot provides a 2D spatial visualization of a participant's gaze trajectory directly overlaid on top of the stimulus image. It displays fixations as circles (where the circle's radius corresponds to the fixation duration) and saccades as connecting lines, mapping the exact sequence of visual attention.

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/basic/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/basic/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/basic/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/basic/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/basic/workspace/#removing-a-plot)

## Metric Contract

- **Metric Contract**: This visualization renders spatial coordinates directly and does not consume metrics from the Metric Library.

## Configuration via Settings Pane

Clicking the Scanpath Plot card in the workspace selects the plot and opens its configuration options in the sidebar **Settings Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Select the stimulus on which to overlay the scanpath. The stimulus dimensions and image will serve as the background for the 2D coordinate plot.
- **Edit stimulus library…**: Opens the Stimuli Modification modal to manage stimulus files and backgrounds.

### Participant
Select the individual participant whose gaze trajectory you want to visualize. The Scanpath Plot displays one participant's scanpath at a time.
- **Edit participants…**: Opens the Participant Modification modal to customize participant properties and metadata.

### Display
Configure the visual annotations rendered on the spatial overlay.
- **Show fixation order line**: Check to render connecting line segments (saccades) between sequential fixations.
- **Show fixation numbers**: Check to print sequence indices (e.g. 1, 2, 3...) inside each fixation circle to show the progression order.

### Areas of Interest
Filters which Areas of Interest (AOIs) are overlaid on the stimulus. AOIs are rendered as translucent colored shapes on top of the background.
- **Configure AOI Library…**: Opens the AOI Modification modal to add, remove, reshape, rename, or color-code AOIs.

### Export
Located at the bottom of the Settings Pane:
- **Download plot…**: Opens the export modal to download the spatial plot.
  - *File formats*: PNG (recommended) or JPG.
  - *Dimensions*: Customizable width (height calculated automatically to match stimulus aspect ratio).
  - *Quality*: Adjustable DPI setting.
  - *Margins*: Configurable margins.
  - *Preview*: Live render of the output before saving.

## Interpretation

Use the Scanpath Plot to:
- **Analyze spatial trajectory**: See exactly where a participant looked and trace the path they took through the stimulus.
- **Observe duration density**: Identify regions of sustained visual processing based on larger fixation circles.
- **Verify AOI alignment**: Check if a participant's fixations landed precisely within target boundaries or hovered around edges.
