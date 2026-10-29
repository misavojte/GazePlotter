# Recurrence Plot

In eye tracking, a recurrence plot (RP) shows when one participant's gaze returns to a place it has already visited. Each fixation is a line across the plot, and a dot where the lines of fixations i and j cross means the two fixations landed in the same spatial region. Read it to see whether a participant repeats parts of their scanpath, revisits regions after long intervals, or works through the stimulus in distinct phases.

![Recurrence Plot card in the workspace: AOI recurrences between fixations of participant Astrid on the Yarbus Remember clothes stimulus.](/docs/images/recurrence-plot.webp)

| | |
| --- | --- |
| **Scope** | One stimulus, one participant |
| **Input** | That participant's fixations in temporal order, with their positions (for *Fixed distance* and *Fixed grid*) or AOI hits (for *AOI*) |
| **Metric Library** | Not used: the plot computes recurrence directly from the fixation sequence |

> **Quantitative RQA Analysis**: The quantitative metrics describing these recurrence structures (Recurrence Rate, Determinism, Laminarity) live in the Metric Library. See [Recurrence Quantification Analysis (RQA) Metrics](/docs/metrics/rqa) for their definitions and ordinal windowing parameters.

## When to Use It

- **Repetition in one viewing**: whether the participant repeats a scanpath segment, and after what lag.
- **Revisits**: how soon, and how often, gaze returns to regions it has already covered.
- **Viewing phases**: block structure shows stretches of viewing confined to one region.
- **Checking RQA values**: see the structures behind a participant's Recurrence Rate, Determinism, or Laminarity.

## Reading the Plot

Interpretation of line structures in a recurrence plot depends on the axis convention. GazePlotter uses the following:

- **Y-axis (vertical), Fixation i**: index increasing upward (fixation 1 at the bottom, fixation N at the top).
- **X-axis (horizontal), Fixation j**: index increasing rightward (fixation 1 at the left, fixation N at the right).
- **Main diagonal**: runs from **bottom-left to top-right** (i = j), drawn as a light guide line.
- **Visual upper triangle** (above diagonal): points where i &gt; j.
- **Visual lower triangle** (below diagonal): points where i &lt; j.
- **Dots**: each takes the color of fixation j's AOI, or the default dot color when that fixation is outside every AOI. With **Duration weighting**, size and opacity grow with the two fixations' combined duration.

Fixation 1 sits on the axes, so the bottom-left corner is the pair (1, 1), labeled once with **1**, and fixation N sits on the top and right edges. Ticks mark round fixation numbers on all four edges. All directional terms on this page refer to this visual layout.

## Add a Recurrence Plot

1. Load your data: drop the files anywhere on the page, or use **Import**. See [Uploading Data](/docs/upload-data/) for the supported formats.
2. In the rail on the left, click **Add Visualization**, then **Gaze behavior** > **Recurrence Plot**. When another plot is selected, the new one opens on its stimulus.
3. The pane on the right opens with the plot's settings. Pick the **Stimulus** and the **Participant**.

To move, resize, duplicate, or remove the card, see [Plot Manipulation](/docs/workspace/#plot-manipulation).

## Settings

Select the card to open its settings in the **Pane** (a bottom sheet on mobile). The sections, in pane order:

### Stimulus
Choose the stimulus to analyze. Only fixations recorded for that stimulus are included.
- **Edit stimuli & selections**: Opens the [Stimuli Library](/docs/workspace/stimuli-library/) to manage stimulus files and build stimulus selections.

### Participant
Select which participant's fixation sequence to analyze. The recurrence plot operates on a single participant at a time. The fixation index order follows the temporal order of recorded fixations for the selected stimulus.
- **Edit participants & selections**: Opens the [Participant Library](/docs/workspace/participant-library/) to rename or reorder participants.

### Method
Configure the criteria used to decide whether two fixations are recurrent. The method decides which further control appears; it is listed under the method that reveals it. Without spatial data, only *AOI* is offered.
- **Recurrence method**: Rule that determines when two fixations count as recurrent.
  - *Fixed distance* (default): Two fixations i and j are recurrent if their Euclidean distance on the stimulus plane is ≤ the radius.
    - **Radius [gaze units]**: Maximum distance between two fixation centroids, in the data's gaze coordinates (pixels for most trackers), for them to count as recurrent. Default 50.
  - *Fixed grid*: The stimulus plane is partitioned into a uniform grid; two fixations are recurrent if they fall within the same cell.
    - **Cells per axis**: Number of grid divisions along each axis (10 creates a 10×10 grid).
  - *AOI*: Two fixations are recurrent if they share at least one Area of Interest. Fixations not assigned to any AOI are never recurrent with any other fixation under this criterion. When one AOI contains every fixation, every pair is recurrent; the plot then says so and suggests another AOI selection or method.
- **Duration weighting**: When checked, each recurrent dot's radius and opacity scale with the combined duration of the two fixations (t_i + t_j). Larger, more opaque dots indicate pairs of longer-duration fixations.
- **Min line length**: Minimum run length (in consecutive recurrent points) required for a line structure to be recognized in highlight mode (from 2 to 20).

### Visualization
Configure highlights and masking options.
- **Highlight**: Emphasizes recurrent points that form qualifying line structures. Non-highlighted points are dimmed:
  - *None*: No highlighting. All recurrent points rendered at full opacity.
  - *Diagonal lines*: Highlights points belonging to diagonal line runs (parallel to the main diagonal) of length ≥ **Min line length**. Indicates periodic recurrence: the gaze returned to the same region after a consistent time lag.
  - *Horizontal lines*: Highlights horizontal line runs of length ≥ **Min line length**. In the visual lower triangle (i &lt; j, fixed row i): fixation i recurs with many consecutive later fixations, indicating a laminar state anchored at time i.
  - *Vertical lines*: Highlights vertical line runs of length ≥ **Min line length**. In the visual lower triangle (i &lt; j, fixed column j): many early fixations recur with fixation j, indicating a region revisited heavily before time j.
- **Masking**: Controls which recurrent points are drawn:
  - *None*: All recurrent points drawn, including the main diagonal, where every fixation recurs with itself (Default).
  - *Diagonal*: The main diagonal's points (i = j) are hidden; its guide line stays.
  - *Diagonal + lower*: The main diagonal and the entire visual lower triangle (i &lt; j) are covered by a solid gray region. Only the visual upper triangle (i &gt; j) is plotted as recurrent dots.

> **Symmetry note**: Because the recurrence matrix is symmetric (R[i,j] = R[j,i]), horizontal structures in the visual lower triangle are reflected as vertical structures in the visual upper triangle, and vice versa. The highlight is mirrored accordingly.

### Time range
Filter the temporal range of fixations.
- **Start / ms**: Limit the minimum time boundary.
- **End / ms (0 = Auto)**: Limit the maximum time boundary, or leave at 0 for automatic duration matching.

### Areas of Interest
Filters which Areas of Interest (AOIs) are active when using the *AOI* recurrence method.
- **AOI selection**: A dropdown containing *All* and saved AOI selections; AOIs outside the picked selection count as no-AOI in this plot.
- **Edit AOIs & selections**: Opens the [AOI Library](/docs/workspace/aoi-library/) to customize names, colors, merges, and selections.

### Export
Located at the bottom of the Pane:
- **Download plot**: Opens the [Figure Export](/docs/export/figures/) dialog to save the recurrence plot as a PNG or JPG.
- **Download segments**: Opens the [Segmented Data](/docs/export/segmented-data/) export preset to this plot's stimulus, participant and AOI selection, over whole recordings.

## Interactivity

- **Pair details**: Hovering a point shows the pair in a tooltip and marks fixation i's row and fixation j's column with dashed lines.
- **Linked hovering**: When another plot points at a moment of this participant's recording, the fixation held at that moment is marked the same way, along both its row and its column. See [Linked Hovering Across Plots](/docs/visualizations/#linked-hovering-across-plots).

## Interpreting Patterns

All directional descriptions below assume the convention in [Reading the Plot](#reading-the-plot): Fixation i on the y-axis increasing upward, Fixation j on the x-axis increasing rightward, and the main diagonal running bottom-left to top-right.

| Pattern | What it suggests |
| --- | --- |
| **Diagonal lines** (parallel to main diagonal) | Periodic revisitation: the participant repeated a similar scanpath segment after a consistent time lag. Longer diagonal lines indicate more sustained repetition. |
| **Anti-diagonal lines** (perpendicular to main diagonal) | The fixation sequence was traversed in reverse order: the gaze retraced its earlier path backwards. |
| **Horizontal lines** | Fixation i recurred with many consecutive later fixations: the gaze was "trapped" in a region that was revisited repeatedly over an extended period. |
| **Vertical lines** | Many consecutive earlier fixations recurred with fixation j: a region that had been visited persistently was returned to at time j. |
| **Recurrences clustered near the diagonal** | Short-range temporal repetition: gaze returned quickly to the same regions. |
| **Recurrences spread far from the diagonal** | Long-range recurrence: the participant returned to the same regions after long intervals. |
| **Visible block structure** | Distinct fixation phases, each confined to a different spatial region. Block boundaries mark transitions between phases. |

## Related

- [Scanpath](/docs/visualizations/scanpath/): the same participant's fixations drawn over the stimulus.
- [Scarf Plot](/docs/visualizations/scarf-plot/): the AOI sequence of every participant over time.
- [Scanpath Similarity](/docs/visualizations/scanpath-similarity/): similarity between the sequences of different participants, rather than within one.
- [RQA Metrics](/docs/metrics/rqa): Recurrence Rate, Determinism, and Laminarity as numbers.
