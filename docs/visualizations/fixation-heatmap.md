# Fixation Heatmap

The Fixation Heatmap pools the eye-tracking fixations of a participant selection on one stimulus into one smoothed map. Every fixation adds its duration, or a count of one, through a Gaussian kernel, so regions that collected much fixation time read as hot. When the stimulus has an image as [reference media](/docs/workspace/stimuli-library/#reference-media), the map is drawn over it and clipped to it. The same map can also be drawn as an opacity map: a dark mask over the stimulus that clears where people looked, so only the viewed parts of the image show. A play bar under the plot animates the map over recording time, over the video frame when the stimulus is a video, see [Playback](#playback).

The map is built from fixations as classified in the source file. GazePlotter stores one coordinate per fixation (for Tobii Pro Lab: `Mapped fixation X/Y` or `Fixation point X/Y`), not raw gaze samples, so there is no raw-gaze variant of the map.

![Fixation Heatmap card in the workspace: fixation duration share of all participants over the Yarbus Remember clothes painting.](/docs/images/fixation-heatmap.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, a participant selection |
| **Input** | Fixations with X/Y coordinates; the plot is offered when the dataset has them. The stimulus's reference image or video when attached. |
| **Metric Library** | Not used, but the plot follows the library's time-range rules, so its totals agree with [Fixation count](/docs/metrics/counts-latency/) and [dwell time](/docs/metrics/durations/): a fixation's duration is clipped to the time range, and a fixation is counted when its midpoint lies in the range. |

> **Try it**: The [demo workspace](/) opens with this heatmap of all participants over the Yarbus Remember clothes painting.

## When to Use It

- **Where a group looked**: see which regions of a stimulus collected the most fixation time across participants.
- **What people saw**: the opacity map hides what nobody looked at and leaves the viewed regions in their own colors, which reads at a glance in a presentation.
- **Group comparison**: put two participant selections side by side on a shared color scale, see [Comparing Heatmaps](#comparing-heatmaps).
- **Attention over time**: play the map to watch where the group's attention builds up, or where it is within the last few seconds, over the video frame on a video stimulus. See [Playback](#playback).
- **Figures for a paper**: the legend and data summary travel with the exported figure, see [Report These Settings](#report-these-settings).

## Reading the Plot

Below the map, the legend and a data summary state everything needed to read and reproduce it. Both are part of exported figures.

- **Legend**: The color bar from 0 to the scale maximum, drawn with the map's opacity and fade as they look on a white background (over an image, the colors mix with it). In the opacity map, the bar runs from the mask color, where nobody looked, to white, where the mask is clear. Its title says what the color means, for example `Fixation duration share / % · max auto · mean of 12 participants · t ≥ 1000 ms`: the quantity and unit, whether the maximum is automatic or fixed, the N it averages over, and the time range.
- **Data summary**: The participant selection and the kernel (`R = 94 auto · σ = 31`), then only the warnings that apply: a peak above an explicit **Scale max** (`peak 9,040 ms > max 1,000 ms`), a video background that was not drawn, a radius below the grid resolution (peaks then read low), fixations outside the media (or outside the view, without media), fixations without coordinates, and participants without located fixations. The number of mapped fixations comes last. The summary wraps onto up to three lines instead of cutting clauses.

Without reference media, the view frames all fixations on the stimulus, plus a margin of R, the same frame for every participant selection and time range. A few fixations far outside the bulk (more than half its size past its edges) are left outside the view; they still count, and the data summary lists them.

## Add a Fixation Heatmap

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/).
2. In the rail on the left, click **Add Visualization**, then **Gaze behavior** > **Fixation Heatmap**. When another plot is selected, the new one opens on its stimulus and participants.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** first.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Select the stimulus whose fixations to map. With a reference image attached, the image is drawn under the map and the heat is clipped to it.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to rename stimuli, build stimulus selections, and attach or align reference media.

### Participants
- **Participant selection**: The participants whose fixations are pooled: *All* or a saved [participant selection](/docs/workspace/participant-library/#participant-selections); **Hide participants without data** leaves out those with no recording on the stimulus. Participants recorded on the stimulus without a located fixation in the time range are left out of the average (N) and counted in the data summary.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/).

### Method
The settings that decide the numbers on the map. The collapsed section header reads them back, for example *Duration, share, R auto*.
- **Accumulate**: What each fixation adds.
  - *Fixation duration*: Its duration, clipped to the time range (default).
  - *Fixation count*: 1 for each fixation whose midpoint lies in the time range.
- **Normalization**: How participants are combined.
  - *Share per participant*: Each participant's map is divided by that participant's own total and the maps are averaged, in %. Every participant weighs the same, however long they looked (default).
  - *Mean per participant*: The maps are averaged in the accumulated unit (ms or fixations per participant). Participants who looked longer weigh more.
- **Radius R (0 = Auto: …)**: The kernel radius R in gaze-coordinate units (pixels for Tobii Pro Lab data); the kernel's σ is R / 3. 0 = Auto: 5 % of the longer side of the central 98 % of all fixations in the dataset, shown in the label. One auto radius applies to every stimulus and participant selection of the dataset.

### Visualization
The collapsed section header shows the view.
- **View**: How the map is drawn. Both views show the same map, so switching never changes the numbers.
  - *Heatmap*: Colors over the stimulus that rise with the map value (default).
  - *Opacity map*: A mask over the stimulus that is at its strongest where the map is 0 and clears linearly toward the scale maximum.
- **Color scale**: How map values become colors.
  - **Color scale picker**: The gradient stops (default *Yellow to Red*).
  - **Scale max / ms (0 = Auto)**: The value that takes the top color, in the map's unit (the label shows *ms*, *fixations*, or *%*). 0 = Auto: this map's own peak, rounded up at the third significant digit. In the opacity map, Auto is half the peak, so the most viewed regions show fully clear rather than only the single peak. Values above an explicit maximum take the top color, shown as a cap at the end of the legend. Changing **Accumulate** or **Normalization** resets it to 0.
  - **Opacity / %**: Heat opacity, 0 to 100 (default 70). Values in the lowest 5 % of the scale fade in from transparent, so blobs have soft edges. Heatmap only.
  - **Mask color**: The opacity map's mask (default black). Opacity map only.
  - **Mask opacity / %**: The mask's opacity where the map is 0, from 0 to 100 (default 90). Opacity map only.
- **Show fixations**: Draws every mapped fixation as a small dark dot over the heat, exposing how many fixations, and which outliers, the map rests on.
- **Background**: What lies under the heat or the mask. Offered when the stimulus has a reference image or video. A video frame is drawn only during playback; the parked map sits on white.
  - *Image*: The reference image as it is (default).
  - *Grayscale image*: The image without color, so the heat colors stand out on a colorful stimulus.
  - *Dimmed grayscale image*: The grayscale image faded halfway toward white, for the strongest heat contrast.
  - *None*: Heat only, on white, inside a thin outline of the image's extent. The only setting where the legend matches the map pixel for pixel, which suits reading values off the color bar.
- **Playback**:
  - **Trail length (ms)**: During playback the map covers only the last N milliseconds before the playhead. Leave it empty (**All**) to accumulate everything since the start of the range. On a video stimulus an unset trail is 2 s.
  - **Speed**: Playback rate relative to recording time, from 0.25x to 2x. On a shared clock, the plot that started playback sets the rate.
  - **Play with other plots of this stimulus**: On by default. The heatmap plays on the stimulus's shared clock with its scanpaths and other heatmaps, and the stimulus's time-axis plots show the playback time. Uncheck to play this plot on its own.

### Time range
Limit the fixations the map is built from (Tobii Pro Lab's Time of interest).
- **Start / ms**: Fixations before it are left out; one that straddles it is clipped (duration) or counted by its midpoint (count).
- **End / ms (0 = Auto)**: The upper bound, or 0 for the end of the recording.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the heatmap as a PNG or JPG, with its legend and data summary. Exports always render the full parked map, not a playback frame.
- **Download segments**: Opens the [Segmented Data](/docs/export/segmented-data/) export preset to this plot's stimulus and participant selection, over whole recordings.

## Playback

A control bar below the plot animates the map over recording time. At each moment the map covers a time window that ends at the playhead: everything since the start of the range with **Trail length** on *All*, or only the last N milliseconds with a set trail. Fixations enter the window by the same rules as the time range: a fixation adds its duration clipped to the window, or counts once its midpoint lies inside. The legend title shows the window instead of the time range, for example `t ≤ 2340 ms`.

- **Play / Pause**: Also **Space** while the pointer is over the plot.
- **Seek bar**: The filled part is the window. Drag its left edge to change the trail length; drop it at the start for **All**.
- **Pause** holds the frame, so it can be hovered and read like the parked map.

The colors do not rescale during playback. Each frame is normalized with the parked map's basis, each participant's total fixation time over the whole range and the same N, so a frame value can never exceed the parked value at that point. With **Trail length** on *All*, the map builds up frame by frame and the last frame is the parked map. With a set trail it slides: the window's share of the whole, not of the window itself, so a quiet second reads as cold rather than as a rescaled hot spot.

Heatmaps and scanpaths of one stimulus play on one shared clock, and the stimulus's [Scarf Plot](/docs/visualizations/scarf-plot) (Absolute timeline), [AOI Timeline](/docs/visualizations/aoi-timeline), and [Metric Timeline](/docs/visualizations/metric-timeline) show the playback time with their dashed line. Hovering the seek bar marks that moment on them too.

On a **video stimulus**, the current frame is drawn under the heat while the clock has a time, so the map shows what the group looked at in the scene on screen. Set **Video starts at** in the media's settings when the video does not start with the recording. The plot rests at the end of its first trail, frame and heat agreeing, and returns there when the run ends. With **Trail length** on *All* the parked plot is the full map on white, as a static map over one arbitrary frame of a moving scene would mislead. Exports always render the parked map.

Playback recomputes the map on every frame. With the automatic radius this takes a few milliseconds; a very small radius on a large stimulus can lower the frame rate, while the clock keeps recording time.

## Interactivity

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
- **Dynamic stimuli**: The parked map of a video stimulus sits on white inside the video's outline: a static map over a moving scene is only meaningful for a time slice in which the scene stays put. Use [Playback](#playback) with a short trail to see the heat over the frame on screen at that moment, or narrow the **Time range** to such a slice. For screen recordings or scene camera video, map the gaze onto a snapshot in Tobii Pro Lab and attach the snapshot as an image.
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
| Opacity (80 %) | **Opacity / %** (70) |
| Opacity map | **View**: *Opacity map* |
| Opacity map: Color (black), Opacity (90 %) | **Mask color** (black), **Mask opacity / %** (90) |
| Opacity map: Scale max value (0.5) | **Scale max**: Auto is half the map's peak. |
| Color: green, yellow, red | **Color scale**: the *Green to Red* preset gives the Pro Lab look, but its light middle makes it diverging rather than sequential, and it is not color-blind safe. |
| Time of interest | **Time range** |
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

## Related

- [Scanpath](/docs/visualizations/scanpath/): the fixations of one participant, in order, over the stimulus.
- [Scarf Plot](/docs/visualizations/scarf-plot/): when each participant looked at each AOI.
- [AOI Comparison](/docs/visualizations/aoi-comparison/): fixation time and counts per AOI as numbers, with confidence intervals.
