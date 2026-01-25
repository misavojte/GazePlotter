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

export const TRANSITION_MATRIX_LAYOUT = {
  headerHeight: 150,
  horizontalPadding: 50,
  baseLabelOffset: 5,
  topMargin: 0,
  leftMargin: 30,
  rightMargin: 10,
  minCellSize: 20,
  maxLabelLength: 85,
  COMPACT_THRESHOLD: 26,
  THIN_THRESHOLD: 15,
  LABEL_FONT_SIZE: 12,
  CELL_VALUE_FONT_SIZE: 9,
} as const

export const TRANSITION_MATRIX_DEFAULTS = {
  width: 500,
  height: 500,
  inactiveColor: '#e0e0e0',
  colorScale: ['#f7fbff', '#08306b'],
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
