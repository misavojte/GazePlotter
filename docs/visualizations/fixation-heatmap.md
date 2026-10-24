# Fixation Heatmap

The Fixation Heatmap pools where a selection of participants fixated on one stimulus into one smoothed map. Every fixation adds its duration, or a count of one, through a Gaussian kernel, so regions that collected much fixation time read as hot. When the stimulus has an image as [reference media](/docs/workspace/stimuli-library/#reference-media), the map is drawn over it and clipped to it.

The map is built from fixations as classified in the source file. GazePlotter stores one coordinate per fixation (for Tobii Pro Lab: `Mapped fixation X/Y` or `Fixation point X/Y`), not raw gaze samples, so there is no raw-gaze variant of the map.

> **Plot Operations**: For general canvas operations (moving, resizing, duplicating, or removing plots), see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Metric Contract

- **Metric Contract**: This visualization renders spatial coordinates directly and does not consume metrics from the Metric Library. It follows the library's time-range rules, so its totals agree with [Fixation count](/docs/metrics/counts-latency/) and [dwell time](/docs/metrics/durations/): a fixation's duration is clipped to the time range, and a fixation is counted when its midpoint lies in the range.
- **Data**: Offered when the dataset carries spatial coordinates.

## Configuration via Pane

Clicking the Fixation Heatmap plot card in the workspace selects the plot and opens its configuration options in the sidebar **Pane** (or bottom sheet on mobile). The settings are organized into the following collapsible sections:

### Stimulus
Select the stimulus whose fixations to map. With a reference image attached, the image is drawn under the map and the heat is clipped to it.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to rename stimuli, build stimulus selections, and attach or align reference media.

### Participants
- **Participant selection**: The participants whose fixations are pooled: *All*, *Non-empty*, or a saved [participant selection](/docs/workspace/participant-library/#participant-selections). Participants recorded on the stimulus without a located fixation in the time range are left out of the average (N) and counted in the data summary.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/).

### Method
The settings that decide the numbers on the map. The collapsed section header reads them back, for example *Duration, share, R auto*.
- **Accumulate**: What each fixation adds.
  - *Fixation duration*: Its duration, clipped to the time range (default).
  - *Fixation count*: 1 for each fixation whose midpoint lies in the time range.
- **Normalization**: How participants are combined.
  - *Share per participant*: Each participant's map is divided by that participant's own total and the maps are averaged, in %. Every participant weighs the same, however long they looked (default).
  - *Mean per participant*: The maps are averaged in the accumulated unit (ms or fixations per participant). Participants who looked longer weigh more.
- **Radius (0 = Auto: …)**: The kernel radius R in gaze-coordinate units (pixels for Tobii Pro Lab data); the kernel's σ is R / 3. 0 = Auto: 5 % of the longer side of the central 98 % of all fixations in the dataset, shown in the label. One auto radius applies to every stimulus and participant selection of the dataset.

### Visualization
- **Color scale**: How map values become colors.
  - **Color scale picker**: The gradient stops (default *Yellow to Red*).
  - **Scale max [ms] (0 = Auto)**: The value that takes the top color, in the map's unit (the label shows *ms*, *fixations*, or *%*). 0 = Auto: this map's own peak, rounded up at the third significant digit. Values above an explicit maximum take the top color, shown as a cap at the end of the legend. Changing **Accumulate** or **Normalization** resets it to 0.
  - **Opacity [%]**: Heat opacity, 0 to 100 (default 70). Values in the lowest 5 % of the scale fade in from transparent, so blobs have soft edges.
- **Show fixations**: Draws every mapped fixation as a small dark dot over the heat, exposing how many fixations, and which outliers, the map rests on.
- **Background**: What lies under the heat. Offered when the stimulus has a reference image.
  - *Image*: The reference image as it is (default).
  - *Grayscale image*: The image without color, so the heat colors stand out on a colorful stimulus.
  - *Dimmed grayscale image*: The grayscale image faded halfway toward white, for the strongest heat contrast.
  - *None*: Heat only, on white, inside a thin outline of the image's extent. The only setting where the legend matches the map pixel for pixel, which suits reading values off the color bar.

### Time range [ms]
Limit the fixations the map is built from (Tobii Pro Lab's Time of interest).
- **Start**: Fixations before it are left out; one that straddles it is clipped (duration) or counted by its midpoint (count).
- **End (0 = Auto)**: The upper bound, or 0 for the end of the recording.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the heatmap as a PNG or JPG, with its legend and data summary.

## Reading the Figure

Below the map, the legend and a data summary state everything needed to read and reproduce it. Both are part of exported figures.

- **Legend**: The color bar from 0 to the scale maximum, drawn with the map's opacity and fade as they look on a white background (over an image, the colors mix with it). Its title says what the color means, for example `Fixation duration share / % · max auto · mean of 12 participants · t ≥ 1000 ms`: the quantity and unit, whether the maximum is automatic or fixed, the N it averages over, and the time range.
- **Data summary**: The participant selection and the kernel (`R = 94 auto · σ = 31`), then only the warnings that apply: a peak above an explicit **Scale max** (`peak 9,040 ms > max 1,000 ms`), a video background that was not drawn, a radius below the grid resolution (peaks then read low), fixations outside the media (or outside the view, without media), fixations without coordinates, and participants without located fixations. The number of mapped fixations comes last. The summary wraps onto up to three lines instead of cutting clauses.

Without reference media, the view frames all fixations on the stimulus, plus a margin of R, the same frame for every participant selection and time range. A few fixations far outside the bulk (more than half its size past its edges) are left outside the view; they still count, and the data summary lists them.

### Hover
Hovering the map shows a dashed ring of radius R and a tooltip for the point under it:
- **Map value**: The kernel-weighted value at the point, in the map's unit. It is not the time spent at that pixel.
- **Within R**: The fixations inside the ring, with their total duration.
- **Share of fixation time** / **Share of fixations**: What share of their own total the participants spent inside the ring, averaged over N.
- **Participants**: How many of the N participants have a fixation inside the ring.
- **Largest contributor**: The participant with the largest part of what lies inside the ring, in the plot's own weighting. A hot spot made by one person shows here.
- **X**, **Y**: The point in gaze coordinates.

The participants inside the ring are also marked in the other plots through [linked hovering](/docs/visualizations/#linked-hovering-across-plots), for example as highlighted Scarf Plot rows.

## How the Map Is Computed

For participant j with located fixations i in the time range, each fixation adds its weight w (its clipped duration, or 1) at its position x:

- *Mean per participant*: value(p) = (1 / N) Σ_j Σ_i w_ij K(p − x_ij)
- *Share per participant*: value(p) = (100 / N) Σ_j (1 / W_j) Σ_i w_ij K(p − x_ij)

W_j is participant j's total weight over located fixations in the time range, inside or outside the media; fixations without coordinates are in neither W_j nor the map. N counts the selected participants with W_j > 0.

- **Kernel**: K is a Gaussian with σ = R / 3, shifted to reach exactly zero at R, and 1 at its center. A lone 300 ms fixation of one participant therefore peaks at 300 ms. K is the product of two one-dimensional kernels, so it is zero beyond R along each axis; past R on the diagonal it holds under 1 %.
- **Width**: The kernel's full width at half maximum (FWHM) is about 0.78 R. Tobii Pro Lab's kernel has an FWHM of about R, so the same radius looks about 22 % tighter here.
- **Grid**: Values are computed on a grid of R / 16 cells, placed identically for every participant selection and time range of a stimulus, so maps of one stimulus line up cell by cell. A grid holds at most about 4.2 million cells; a very small R on a very large stimulus would need more, so its cells grow, and when they exceed R / 12 the data summary warns that peaks read low.
- **Within R** in the tooltip is a disc of radius R; it ignores the kernel's corner tails beyond R, which are under 1 %.

### Choosing a Radius
GazePlotter has no viewing geometry, so R is set in gaze units. A common choice is σ of about 1° of visual angle, which covers foveal vision and typical tracker accuracy; then R is about 3° in pixels. One degree spans 2 · d · tan(0.5°) on the screen at viewing distance d. For example, a 23.8-inch 1920 px wide screen (52.7 cm) viewed from 65 cm gives 1.13 cm, or about 41 px per degree: σ = 41 px, R = 123 px.

## Comparing Heatmaps

An automatic maximum fits each map to its own peak, so the colors of two automatic maps are not comparable. To compare, for example, two participant selections:

1. Add one Fixation Heatmap per selection, on the same stimulus and with the same **Method** settings.
2. Read the larger automatic maximum off their legends.
3. Select both plots (hold `Cmd` / `Ctrl` / `Shift` and click) and enter that value in **Scale max**. One edit sets both.

The legends then read *max fixed*, and exported figures keep the shared scale. With *Share per participant*, maps of groups of different sizes stay comparable.

## Reading a Heatmap Responsibly

- **Time and order are gone**: One long look and many short ones can look alike. Pair the map with the [Scarf Plot](/docs/visualizations/scarf-plot/) or [Scanpath](/docs/visualizations/scanpath/), or narrow the **Time range**.
- **Hot is relative**: An automatic scale makes every map look equally hot. Read the maximum on the legend, and fix it when comparing.
- **No color does not mean not seen**: Peripheral vision, data loss, and calibration errors all leave regions cold. Fixations without coordinates are counted in the data summary but cannot be placed.
- **Small groups**: One participant can make a hot spot. Check **Participants** and **Largest contributor** in the tooltip, and turn on **Show fixations**.
- **The radius shapes the picture**: A larger kernel merges neighboring spots, a smaller one splits them. Report it.
- **Central bias**: The first fixation after stimulus onset often lands at the screen center or on a former fixation cross. Set the **Time range** Start to 500 to 1000 ms to leave it out.
- **Calibration offset**: An offset shifts the whole map. Check it with **Show fixations** and the [media alignment](/docs/workspace/stimuli-library/#aligning-media-on-fixations).
- **Dynamic stimuli**: A video background is not drawn (the map sits on white inside the video's outline): a static map over a moving scene is only meaningful for a time slice in which the scene stays put, and the video's frame follows playback in other plots. For screen recordings or scene camera video, map the gaze onto a snapshot in Tobii Pro Lab and attach the snapshot as an image.
- **Descriptive, not inferential**: A heatmap shows where attention went; it does not test a difference.

## Coming from Tobii Pro Lab

| Tobii Pro Lab | Fixation Heatmap |
| :--- | :--- |
| Absolute count | *Fixation count*, *Mean per participant*: the same shape; Pro Lab sums over participants, GazePlotter divides the sum by N. |
| Absolute duration | *Fixation duration*, *Mean per participant*: the same shape. |
| Relative count, Relative duration | The same shape as the absolute map: Pro Lab divides by the total in the Time of interest, which rescales without reshaping. |
| (none) | *Share per participant*: each participant divided by their own total fixation duration or count. Older Tobii Studio versions divided by viewing time instead. |
| Radius (100 px) | **Radius**: the kernel's reach; σ = R / 3, FWHM about 0.78 R (about R in Pro Lab). |
| Scale max value | **Scale max** |
| Opacity (80 %) | **Opacity [%]** (70) |
| Color: green, yellow, red | **Color scale**: the *Green to Red* preset gives the Pro Lab look, but its light middle makes it diverging rather than sequential, and it is not color-blind safe. |
| Time of interest | **Time range [ms]** |
| Background: Media / White | **Background**: *Image* / *None* (plus *Grayscale image* and *Dimmed grayscale image*); Black and Transparent are not offered. |
| Gaze filter | Fixations as classified in the exported file. |

## Report These Settings

A heatmap is reproducible only with its settings. Report:
- The software version (GazePlotter 1.10.2 changed how a Start-only time range clips fixations).
- The fixation source: tracker, fixation filter (for example Tobii I-VT), and the coordinate column.
- The stimulus, the participant selection, and N.
- The time range, with its conventions (clipped durations, midpoint counts).
- **Accumulate** and **Normalization**.
- R and σ, in pixels and degrees.
- **Scale max** (automatic or the fixed value) and the color scale.

A methods sentence to adapt:

> Fixation heatmaps were computed in GazePlotter 1.10.2 from fixations classified by the Tobii I-VT filter (Fixation point X/Y). For each participant, fixation durations from 1000 ms after stimulus onset to the end of the trial (clipped to that range) were smoothed with a Gaussian kernel (σ = 41 px, about 1°, tapered to zero at R = 3σ), divided by the participant's total duration of located fixations within that range, and averaged across the 16 participants of each group. All maps share a fixed color scale maximum of 2.4 %.

## Data Notes

- **Tobii Pro Lab snapshots**: A stimulus with its own `Mapped fixation X/Y [stimulus]` columns uses only those; an empty cell is a fixation that was not mapped onto the snapshot, and it has no coordinate. Each snapshot has its own pixel frame, so in snapshot studies consider setting R per stimulus. See [Tobii Pro Lab](/docs/upload-data/tobii-pro-lab/#spatial-coordinates).
- **Custom CSV time series**: That layout splits rows by AOI changes, so each "fixation" is an AOI run located at its first sample, not a fixation centroid. Use a segmented layout with fixation rows for heatmaps. See [Custom CSV](/docs/upload-data/custom-csv/).
