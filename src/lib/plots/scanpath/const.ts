import { UI_COLORS } from '$lib/color'

/** Layout constants: visual primitives only; the axis gutters are measured by usePlot. */
export const SCANPATH_LAYOUT = {
  /** Trail length (ms) on a video when none is set: a moving frame needs a short window. */
  videoTrailMs: 2000,
  /** Tick count per axis. */
  tickCount: 5,

  /** Min/max fixation circle radius in CSS pixels. Area linear in duration;
      long recordings put hundreds on screen, so the density damping below shrinks them. */
  minRadius: 4,
  maxRadius: 15,
  /** Above this many fixations the radius range shrinks progressively
      (√ falloff, floored at half) so dense recordings stay readable. */
  densityThreshold: 150,

  /** Padding around the data bounding box, fraction of bbox side length. */
  bboxPadding: 0.05,

  numberFontSize: 10,
  numberOffset: 4,

  polylineWidth: 1.75,
  circleStrokeWidth: 1.5,

  /** Mark opacity: strong enough to read over a full-color image or video frame. */
  fixationFillAlpha: 0.85,
  polylineAlpha: 0.8,

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
  polyline: UI_COLORS.CONNECTOR,
  numberLabel: UI_COLORS.TEXT_PRIMARY,
  /** White separation halo behind marks and labels, for legibility over
      reference imagery. */
  halo: 'rgba(255, 255, 255, 0.85)',
  /** Hovered-fixation ring. Cool blue against the warm-orange markers. */
  hoverRing: '#0f62fe',
} as const
