import { PLOT_AXIS_TITLE_GAP, PLOT_TICK_LABEL_GAP } from '../shared/const'

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
  bottomSafetyPx: 0,
  /** Left edge safety beyond the left rotated edge of the Y axis title. */
  leftSafetyPx: 2,

  /** Visible breathing room between tick labels and the axis title text. */
  titleTickGapPx: PLOT_AXIS_TITLE_GAP,

  /** Tick count per axis. */
  tickCount: 5,

  /** Min/max fixation circle radius in CSS pixels. Area linear in duration.
      Deliberately restrained: markers annotate the stimulus, they must not
      dominate it, and long recordings put hundreds of them on screen. */
  minRadius: 3,
  maxRadius: 13,
  /** Above this many fixations the radius range shrinks progressively
      (√ falloff, floored at half) so dense recordings stay readable. */
  densityThreshold: 150,

  /** Padding around the data bounding box, fraction of bbox side length. */
  bboxPadding: 0.05,

  numberFontSize: 10,
  numberOffset: 4,

  polylineWidth: 1.25,
  circleStrokeWidth: 1,

  /** Mark translucency: fills and the path stay under the stimulus imagery
      in visual weight. */
  fixationFillAlpha: 0.65,
  polylineAlpha: 0.55,

  /** Fixation tooltip width (px) — same convention as SCARF_LAYOUT.TOOLTIP_WIDTH. */
  tooltipWidth: 170,
} as const

/**
 * Visual palette. Warm-orange fill with darker stroke is the cross-tool
 * convention (Tobii Pro Lab, BeGaze) for scanpath fixation markers.
 */
export const SCANPATH_COLORS = {
  fixationFill: '#e07a3a',
  fixationStroke: '#a04816',
  polyline: '#5a5a5a',
  numberLabel: '#1f1f1f',
  /** White separation halo behind marks and labels, for legibility over
      reference imagery. */
  halo: 'rgba(255, 255, 255, 0.85)',
  /** Hovered-fixation ring. Cool blue against the warm-orange markers. */
  hoverRing: '#0f62fe',
} as const
