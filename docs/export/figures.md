# Figure Export

The figure export renders workspace plots as publication-ready PNG or JPG images. One dialog covers every cardinality: a single figure downloads directly as an image, several bundle into a single ZIP archive. Use it to regenerate a complete figure set after a data, AOI, or settings revision without exporting each plot individually.

## Opening the Dialog

The same dialog opens from three places; they differ only in which figures are preselected.

- **Export** in the workspace Ribbon, then **Figures (PNG, JPG)** under **Other options**: preselects all plots, or the current workspace selection if one exists. The card appears only when the workspace contains at least one plot.
- **Download plot…** in a plot's pane: preselects that plot.
- **Download plots…** in the bulk pane (several plots selected): preselects the selection.

## Choose Figures

The first step lists every plot in the workspace in reading order (top to bottom, left to right). Each entry shows the plot type and its subtitle (stimulus, participant group) to distinguish same-type plots.

- **Select All** / **Deselect All** toggle the whole list; long lists gain a search field.

## Configure the Output

- **Image format**: PNG (lossless, recommended) or JPG.
- **Resolution [DPI]**: free entry from 72 DPI, with presets for 96 (screen), 150, 300 (print), and 600 DPI. The default is 300 DPI.
- **Margin [px]**: uniform white margin carved out of each figure, applied to all figures. The default is 20 px.

Each figure is exported at its current workspace size and aspect ratio; the resolution setting scales the output pixel density (96 DPI equals on-screen size). To change a figure's exported size or proportions, resize the plot in the workspace.

## Preview

The third step shows each selected figure exactly as it will export, scaled to fit the dialog. With several figures selected, arrows page through the set. The caption below the preview states the real output size, in pixels and in physical print size at the chosen resolution, for example `2500 × 1563 px · 21.2 × 13.2 cm at 300 DPI`.

## Download Contents

A single selected figure downloads as a bare image file named after its plot (e.g. `GazePlotter-ScarfPlot.png`). With several figures, a `GazePlotter-Figures.zip` archive downloads in which each figure is one image, named by its workspace position, plot type, and subtitle, for example:

```
01 Scarf Plot - SMI Base, All Participants.png
02 AOI Comparison - SMI Base.png
03 Transition Matrix - SMI Base.png
```

The position prefix preserves workspace order and keeps names unique. Characters not allowed in file names are replaced with spaces.

Figures render sequentially with a progress readout. A figure that cannot be rendered is reported and left out; the remaining figures still export, and the completion message states how many of the selected figures were included.
