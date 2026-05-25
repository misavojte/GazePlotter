/**
 * Layout costants. Margins are not declared here — they are *measured* per
 * render from the actual tick-label strings and the current font (see
 * `ScanpathPlotFigure.svelte`'s `layout` derived). The constants below are
 * either visual primitives (gaps, paddings, radii) or font configuration that
 * the measurement step needs.
 */
export const SCANPATH_LAYOUT = {
  /** Top edge safety so the plot's 1-px border is fully visible. */
  topSafetyPx: 2,
  /** Right edge safety beyond the last-X-tick-label clamp inside drawPlotArea. */
  rightSafetyPx: 4,
  /** Bottom edge safety below the last line of the X axis title. */
  bottomSafetyPx: 2,
  /** Left edge safety beyond the left rotated edge of the Y axis title. */
  leftSafetyPx: 2,

  /** Visible breathing room between tick labels and the axis title text. */
  titleTickGapPx: 6,

  /** Tick count per axis. */
  tickCount: 5,

  /** Min/max fixation circle radius in CSS pixels. Area linear in duration. */
  minRadius: 4,
  maxRadius: 22,

  /** Padding around the data bounding box, fraction of bbox side length. */
  bboxPadding: 0.05,

  numberFontSize: 11,
  numberOffset: 4,

  polylineWidth: 1.5,
  circleStrokeWidth: 1,
} as const

/**
 * Inter-element gap that `drawPlotArea` itself bakes in between the plot edge
 * and the tick-label baseline. Re-declared here so this module's layout math
 * matches `src/lib/plots/shared/plotArea.ts:24` without a runtime coupling.
 */
export const PLOT_AREA_TICK_LABEL_GAP_PX = 10


/**
 * Visual palette. Warm-orange fill with darker stroke is the cross-tool
 * convention (Tobii Pro Lab, BeGaze) for scanpath fixation markers.
 */
export const SCANPATH_COLORS = {
  fixationFill: '#e07a3a',
  fixationStroke: '#a04816',
  polyline: '#5a5a5a',
  numberLabel: '#1f1f1f',
} as const
