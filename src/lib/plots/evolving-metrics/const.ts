import {
  FONT_PRIMARY,
  GRIDLINE_SECONDARY,
  GRIDLINE_PRIMARY,
} from '$lib/plots/shared/const'
import { withQualifiers } from '$lib/plots/shared/labels'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary/schema'
export { FIXATION_CATEGORY_ID }

export const MARGIN = {
  TOP: 5,
  RIGHT: 10,
  BOTTOM: 55,
  LEFT: 50,
}

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

// Time is the main axis here, so the binning window trails as a mid-dot
// qualifier (e.g. "Elapsed time / ms · 1000 ms window / 100 ms step"); no
// time-range qualifier — the axis itself shows the range.
export function getEvolvingMetricsXAxisLabel(windowDesc: string): string {
  return withQualifiers('Elapsed time / ms', windowDesc)
}
