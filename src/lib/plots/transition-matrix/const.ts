import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color'

/**
 * Defines available aggregation methods for transition matrices
 */
export enum MatrixAggregationMethod {
  SUM = 'sum',
  FREQUENCY_RELATIVE = 'frequencyRelative',
  PROBABILITY = 'probability',
  PROBABILITY_2 = 'probability2',
  PROBABILITY_3 = 'probability3',
  DWELL_TIME = 'dwellTime',
  SEGMENT_DWELL_TIME = 'segmentDwellTime',
}

export { MATRIX_LAYOUT as TRANSITION_MATRIX_LAYOUT } from '$lib/plots/shared'

export const TRANSITION_MATRIX_DEFAULTS = {
  width: 500,
  height: 500,
  inactiveColor: INACTIVE_COLOR,
  colorScale: [...PRESET_PALETTES.BLUE.colors],
  xLabel: 'To AOI',
  yLabel: 'From AOI',
} as const

export const TRANSITION_MATRIX_LEGEND_TITLES: Record<string, string> = {
  [MatrixAggregationMethod.SUM]: 'Absolute frequency',
  [MatrixAggregationMethod.FREQUENCY_RELATIVE]: 'Relative frequency [%]',
  [MatrixAggregationMethod.PROBABILITY]: '1-step probability [%]',
  [MatrixAggregationMethod.PROBABILITY_2]: '2-step probability [%]',
  [MatrixAggregationMethod.PROBABILITY_3]: '3-step probability [%]',
  [MatrixAggregationMethod.DWELL_TIME]: 'Fixation duration [ms]',
  [MatrixAggregationMethod.SEGMENT_DWELL_TIME]: 'Dwell duration [ms]',
}
