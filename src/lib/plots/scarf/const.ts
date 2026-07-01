import { UI_COLORS } from '$lib/color'

/**
 * Unified constants and identifiers for the Scarf Plot.
 */

export const SCARF_IDENTIFIERS = {
  AOI: 'a', // Segment is an Area of Interest fixation
  CATEGORY: 'ac', // Segment is a category (e.g. Saccade)
  EVENT: 'e', // Visibility event marker
  NOT_DEFINED: 'N', // Fallback for null/empty categories or AOIs
} as const

export const SCARF_LAYOUT = {
  // --- Basic Dimensions ---
  HEIGHT_BAR_DEFAULT: 15,
  HEIGHT_NON_FIXATION_DEFAULT: 4,
  SPACE_ABOVE_RECT_DEFAULT: 5,
  HEIGHT_X_AXIS: 20,
  RIGHT_MARGIN: 8,

  // --- Tooltips ---
  TOOLTIP_WIDTH: 150,
  TOOLTIP_HIDE_DELAY: 200,

  // --- Labels and Typography ---
  LEFT_LABEL_MAX_WIDTH: 125,
  AXIS_LABEL_HEIGHT: 40,
  LABEL_FONT_SIZE: 12,
  TICK_LENGTH: 5,

  // --- Styling ---
  GRID_COLOR: UI_COLORS.GRID_PRIMARY,
  GRID_STROKE_WIDTH: 1,

  // --- Legend Configuration ---
  LEGEND_ITEMS_PER_ROW: 3,
  LEGEND_TITLE_HEIGHT: 18,
  LEGEND_ITEM_PADDING: 8,
  LEGEND_GROUP_SPACING: 10,
  LEGEND_ITEM_SPACING: 15,

  // --- Dynamic Scaling & Compact Mode ---
  MAX_BAR_SCALE: 2.0,
  MIN_BAR_HEIGHT: 1,
  MIN_PLOT_HEIGHT_COMPACT: 100,
  COMPACT_MODE_THRESHOLD: 7,

  // --- Combined-mode (overlay) symmetric layout ---
  // Each row is built around a central SEAM = the shared bottom edge (baseline)
  // of the gaze segments. Fixations AND non-fixations are bottom-aligned to the
  // seam; the event band (packed strips) hangs below it, separated by a
  // whitespace gap (EVENT_ZONE_GAP). That gap is the hue-independent separator —
  // events stay distinct from same-coloured fixations regardless of the colours
  // the user sets, with no outline/line needed. Gray is reserved for the
  // dividers BETWEEN participants. Band height is H × (observed max concurrency),
  // uniform across rows so the column scan stays even. Rows are always separated
  // by ≥ MIN_ROW_GAP of whitespace; if that cannot be met at the legibility
  // floor, the plot does not render.
  EVENT_LANE_H: 6, // lane (strip slot) height at scale 1
  // Legibility floor for a single lane (export/projector survival). EVERY
  // concurrent event always gets its own lane at ≥ this height — events are
  // never stacked into one strip, because overlapping them hides that something
  // is happening. High concurrency therefore demands a taller band (and more
  // plot height), never an occluding overlay.
  MIN_EVENT_LANE_H: 4,
  EVENT_LANE_GAP: 1, // gap inside a lane slot → texture separation between stacked strips
  EVENT_ZONE_GAP: 3, // whitespace gap between the gaze baseline (seam) and the event band
  MIN_ROW_GAP: 3, // minimum whitespace between participant rows (hard floor)
  MIN_INTERVAL_PX: 1, // a thin interval must never sub-pixel-vanish
  MIN_POINT_PX: 3, // point events are min-width clamped + drawn distinct from intervals

  // --- Highlight locator rings ---
  // When an identifier is highlighted, non-highlighted segments desaturate and
  // the highlighted ones keep full colour. But a highlighted segment whose true
  // duration is too brief to paint a full pixel of colour gets diluted by the
  // neighbours sharing its pixel and washes out — invisible among them. Rather
  // than inflate its width (which would falsify the duration) or alter the blend,
  // we RING its location: a scale-independent annotation that points at "it's
  // here" without distorting the timeline. Adjacent faint occurrences collapse
  // into one ring at their centroid so a burst of micro-fixations reads as one.
  HIGHLIGHT_VISIBLE_COVERAGE: 0.75, // accumulated highlighted column alpha (Σ coverage × bar-height share, as the blend computes it) within one window must reach this to count as legible; below it the stretch is ringed.
  HIGHLIGHT_WINDOW_PX: 30, // width (logical px) of the legibility window; coverage is summed over same-colour segments whose centres fall within it. Measured in DATA space so a pan can't flicker the verdict.
  HIGHLIGHT_SELF_LEGIBLE_LIMIT: 8, // width (logical px) where a segment is considered easily visible/legible on its own without needing a ring.
  HIGHLIGHT_SINGLE_VISIBLE_LIMIT: 4, // width (logical px) of a single segment above which it is considered clearly visible, suppressing rings for itself and any neighboring segments in its window.
  HIGHLIGHT_MARKER_RADIUS: 8, // desired ring radius (shrunk to fit short rows)
  HIGHLIGHT_MARKER_MIN_RADIUS: 3, // below this the row is too short to host a ring — skip it
  HIGHLIGHT_MARKER_RING_WIDTH: 1, // colored ring stroke; a white halo is drawn beneath for contrast
} as const

// --- Buffer Strides ---
/** Gaze rect record: [x, participantIndex, width, height, orderId, internalY].
 * Kept lean (6 floats) — the buffer is ~1 record per segment and at millions of
 * segments its allocation + write bandwidth dominates the transform. `orderId`
 * (== the segment's local index) is the hover identifier; the raw participant id
 * is derived from the row, not stored. */
export const RECT_STRIDE = 6
/** Event overlay strip buffer: [xNorm, pIndex, wNorm, laneIndex, isPoint]. */
export const OVERLAY_EVENT_STRIDE = 5
