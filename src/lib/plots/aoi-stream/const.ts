import {
  FONT_PRIMARY,
  GRIDLINE_SECONDARY,
  GRIDLINE_PRIMARY,
} from '$lib/plots/shared/const'

export const RIDGELINE_OVERLAP = 0.6

export const MARGIN = {
  TOP: 20,
  RIGHT: 0,
  BOTTOM: 55,
  LEFT: 50,
}

export const HEADER_HEIGHT = 150

export const FLOW_CURVE_TENSION = 0

export const DEFAULT_BIN_COUNT = 200
export const END_BIN_EPSILON = 1e-6
export const FIXATION_CATEGORY_ID = 0

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
