import {
  FONT_PRIMARY,
  GRIDLINE_SECONDARY,
  GRIDLINE_PRIMARY,
} from '$lib/plots/shared/const'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary/schema'
export { FIXATION_CATEGORY_ID }

// Default ridge scale factor (equivalent to overlap ~60%)
export const RIDGELINE_SCALE = 2.5

// Fraction of strip height used for data content (remaining is visual padding)
export const RIDGELINE_CONTENT_FILL = 0.9

/**
 * Floor for the top ridgeline strip's data fraction (`mTop`) when local
 * rendering is requested via `applyMinTopHeight`. Empty / sparse data
 * would otherwise collapse the top strip to zero pixels; this keeps a
 * visible baseline so an empty plot still shows the strip layout.
 */
export const RIDGELINE_MIN_M_TOP = 0.2

/**
 * Stream-graph baseline factor. The stacked totals are centred at
 * `-totals × STREAM_SYMMETRY_FACTOR` so the curve is vertically symmetric
 * around `axisHalfRange`. 0.5 puts the baseline at the midpoint of the
 * total — half above, half below.
 */
export const STREAM_SYMMETRY_FACTOR = 0.5

export const MARGIN = {
  TOP: 5,
  RIGHT: 1,
  BOTTOM: 55,
  LEFT: 50,
}

export const FLOW_CURVE_TENSION = 0

export const AXIS_CONFIG = {
  tickLength: 5,
  fontSize: FONT_PRIMARY.SIZE,
  fontFamily: FONT_PRIMARY.FAMILY,
  color: FONT_PRIMARY.COLOR,
  gridColor: GRIDLINE_SECONDARY.COLOR,
  baselineColor: GRIDLINE_PRIMARY.COLOR,
  tickLabelOffset: 10,
  labelOffset: 24,
}

export const Y_AXIS = {
  LABEL_OFFSET: 36,
  TICK_LABEL_OFFSET: 10,
  // The centered streamgraph uses a symmetric domain (e.g. [-50, +50] for 100%).
  // This factor adds headroom so the plot doesn't touch the top/bottom.
  // Example: 100% total -> half-range=50, with factor 1.5 => axis half-range=75.
  HEADROOM_FACTOR: 1.5,
  TARGET_POSITIVE_TICKS: 3,
}
