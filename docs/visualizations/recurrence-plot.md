---
title: Recurrence Plot
order: 6
---

# Recurrence Plot

The Recurrence Plot (RP) in GazePlotter reveals temporal self-similarity in a single participant's fixation sequence. Each cell in the N×N matrix encodes whether two fixations (at indices i and j) landed in the same spatial region.

> Interested on how to operate with plots in general within the workspace? See:
>
> - [How to move a plot around workspace?](/docs/basic/workspace/#moving-a-plot)
> - [How to resize a plot?](/docs/basic/workspace/#resizing-a-plot)
> - [How to duplicate a plot?](/docs/basic/workspace/#duplicating-a-plot)
> - [How to add a new plot?](/docs/basic/workspace/#adding-visualizations)
> - [How to remove a plot?](/docs/basic/workspace/#removing-a-plot)

## Axis Convention

Interpretation of line structures in a recurrence plot is axis-convention-dependent. GazePlotter uses the following convention:

- **Y-axis (vertical) — Fixation i**, index increasing upward (fixation 1 at the bottom, fixation N at the top).
- **X-axis (horizontal) — Fixation j**, index increasing rightward (fixation 1 at the left, fixation N at the right).
- **Main diagonal** runs from **bottom-left to top-right** (i = j).
- **Visual upper triangle** (above diagonal): cells where i &gt; j.
- **Visual lower triangle** (below diagonal): cells where i &lt; j.

All directional terms in this document refer to this visual layout.

## Basic Controls

In GazePlotter, recurrence plots have the following main controls:

- **[Stimulus](#stimulus)** — a drop-down menu for selecting the stimulus to be analyzed.
- **[Participant](#participant)** — a drop-down menu for selecting which participant's fixation sequence to plot.
- **[View](#view)** — a drop-down menu for selecting the recurrence method and adjusting all plot settings.
- **[More options](#more-options)** (⋮) — a button for accessing additional customization and export options.

### Stimulus

Choose which stimulus to analyze. Only fixations recorded for that stimulus are included.

### Participant

Select which participant's fixation sequence to analyze. The recurrence plot operates on a single participant at a time. The fixation index order follows the temporal order of recorded fixations for the selected stimulus.

### View

The **View** dropdown selects the recurrence criterion — the rule used to decide whether two fixations are recurrent. Clicking a view option opens a settings panel containing all plot parameters.

#### Fixed distance

Two fixations i and j are recurrent if their Euclidean distance on the stimulus plane is ≤ the specified radius.

| Parameter   | Description                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Radius [px] | Maximum screen-space distance (in pixels) between two fixation centroids for them to be counted as recurrent. |

#### Fixed grid

The stimulus plane is partitioned into a uniform grid. Two fixations are recurrent if they fall within the same grid cell.

| Parameter      | Description                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Cells per axis | Number of grid divisions along each axis. The total grid is (Cells per axis) × (Cells per axis). |

#### AOI

Two fixations are recurrent if they share at least one Area of Interest. Fixations not assigned to any AOI are never recurrent with any other fixation under this criterion.

---

All three views share the following common settings:

#### Highlight

Emphasizes recurrent points that form qualifying line structures. Non-highlighted points are dimmed.

| Option           | Description                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| None             | No highlighting. All recurrent points rendered at full opacity.                                                                                                                                                                |
| Diagonal lines   | Highlights points belonging to diagonal line runs (parallel to the main diagonal) of length ≥ **Min line length**. Indicates periodic recurrence — the gaze returned to the same region after a consistent time lag.           |
| Horizontal lines | Highlights horizontal line runs of length ≥ **Min line length**. In the visual lower triangle (i &lt; j, fixed row i): fixation i recurs with many consecutive later fixations, indicating a laminar state anchored at time i. |
| Vertical lines   | Highlights vertical line runs of length ≥ **Min line length**. In the visual lower triangle (i &lt; j, fixed column j): many early fixations recur with fixation j, indicating a region revisited heavily before time j.       |

> **Symmetry note**: Because the recurrence matrix is symmetric (R[i,j] = R[j,i]), horizontal structures in the visual lower triangle are reflected as vertical structures in the visual upper triangle, and vice versa. The highlight is mirrored accordingly.

#### Masking

Controls which cells of the N×N matrix are rendered.

| Option           | Description                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| None             | All N×N cells rendered, including the main diagonal.                                                                                                                           |
| Diagonal         | Main diagonal cells (i = j) are rendered as solid gray squares. All off-diagonal recurrent cells are rendered as dots. **Default.**                                            |
| Diagonal + lower | The main diagonal and the entire visual lower triangle (i &lt; j) are rendered as a solid gray region. Only the visual upper triangle (i &gt; j) is plotted as recurrent dots. |

#### Duration weighting

When enabled, each recurrent dot's radius and opacity scale with the combined duration of the two fixations (t_i + t_j). Larger, more opaque dots indicate pairs of longer-duration fixations. Duration weighting is independent of the active highlight mode.

#### Min line length [L]

Minimum run length (in consecutive recurrent cells) required for a line structure to be recognized in highlight mode. Default: 2.

### More options

The recurrence plot menu (⋮) provides quick access to:

#### Customization Options

- **Stimulus customization** — Manage stimulus properties and settings. See [Stimuli Customization](/docs/basic/stimuli-customization/) for details.

#### Download plot

Export the recurrence plot as an image file:

- **File formats**: PNG (recommended, transparent background) or JPG (white background)
- **Dimensions**: Customizable width (height maintained as square)
- **Quality**: Adjustable DPI for screen (96 DPI) or print (300 DPI)
- **Margins**: Configurable top, right, bottom, left margins
- **Preview**: Live preview before downloading

## Interpretation

| Pattern                                                        | What it suggests                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Diagonal lines (upward, parallel to main diagonal)             | Periodic revisitation — the participant repeated a similar scanpath segment after a consistent time lag. Longer diagonal lines indicate more sustained repetition. |
| Anti-diagonal lines (downward, perpendicular to main diagonal) | The fixation sequence was traversed in reverse order — the gaze retraced its earlier path backwards.                                                               |
| Horizontal lines                                               | Fixation i recurred with many consecutive later fixations — the gaze was "trapped" in a region that was revisited repeatedly over an extended period.              |
| Vertical lines                                                 | Many consecutive earlier fixations recurred with fixation j — a region that had been visited persistently was returned to at time j.                               |
| Recurrences clustered near the diagonal                        | Short-range temporal repetition — gaze returned quickly to the same regions.                                                                                       |
| Recurrences spread far from the diagonal                       | Long-range recurrence — the participant returned to the same regions after long intervals.                                                                         |
| Visible block structure                                        | Distinct fixation phases, each confined to a different spatial region. Block boundaries mark transitions between phases.                                           |

> **Axis convention reminder**: All directional descriptions above assume GazePlotter's convention: Fixation i on the y-axis increasing upward, Fixation j on the x-axis increasing rightward. The main diagonal runs bottom-left to top-right.
