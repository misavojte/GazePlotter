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

export const TRANSITION_MATRIX_AGGREGATION_METHODS = [
  { value: MatrixAggregationMethod.SUM, label: 'Transition Counts (Sum)' },
  {
    value: MatrixAggregationMethod.FREQUENCY_RELATIVE,
    label: 'Relative Frequency (%)',
  },
  {
    value: MatrixAggregationMethod.PROBABILITY,
    label: 'Transition Probability (1-step)',
  },
  {
    value: MatrixAggregationMethod.PROBABILITY_2,
    label: 'Transition Probability (2-step)',
  },
  {
    value: MatrixAggregationMethod.PROBABILITY_3,
    label: 'Transition Probability (3-step)',
  },
  { value: MatrixAggregationMethod.DWELL_TIME, label: 'Average Dwell Time' },
  {
    value: MatrixAggregationMethod.SEGMENT_DWELL_TIME,
    label: 'Segment Dwell Time',
  },
] as const

export type TransitionMatrixAggregationMethodId = MatrixAggregationMethod

export function getMatrixMethodLabel(value: MatrixAggregationMethod): string {
  const method = TRANSITION_MATRIX_AGGREGATION_METHODS.find(
    m => m.value === value
  )
  return method?.label || value
}

export const TRANSITION_MATRIX_LAYOUT = {
  headerHeight: 150,
  horizontalPadding: 50,
  baseLabelOffset: 5,
  topMargin: 30,
  leftMargin: 30,
  minCellSize: 20,
  maxLabelLength: 85,
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
