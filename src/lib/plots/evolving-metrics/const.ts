import {
  FONT_PRIMARY,
  GRIDLINE_SECONDARY,
  GRIDLINE_PRIMARY,
} from '$lib/plots/shared/const'
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

export function getEvolvingMetricsXAxisLabel(windowDesc: string): string {
  if (windowDesc) {
    return `Elapsed time [ms; ${windowDesc}]`
  }
  return 'Elapsed time [ms]'
}
