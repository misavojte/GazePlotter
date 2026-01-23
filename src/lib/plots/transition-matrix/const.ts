/**
 * Defines available aggregation methods for transition matrices
 */
export enum AggregationMethod {
  SUM = 'sum',
  FREQUENCY_RELATIVE = 'frequencyRelative',
  PROBABILITY = 'probability',
  PROBABILITY_2 = 'probability2',
  PROBABILITY_3 = 'probability3',
  DWELL_TIME = 'dwellTime',
  SEGMENT_DWELL_TIME = 'segmentDwellTime',
}

export const TRANSITION_MATRIX_AGGREGATION_METHODS = [
  { value: AggregationMethod.SUM, label: 'Transition Counts (Sum)' },
  {
    value: AggregationMethod.FREQUENCY_RELATIVE,
    label: 'Relative Frequency (%)',
  },
  {
    value: AggregationMethod.PROBABILITY,
    label: 'Transition Probability (1-step)',
  },
  {
    value: AggregationMethod.PROBABILITY_2,
    label: 'Transition Probability (2-step)',
  },
  {
    value: AggregationMethod.PROBABILITY_3,
    label: 'Transition Probability (3-step)',
  },
  { value: AggregationMethod.DWELL_TIME, label: 'Average Dwell Time' },
  { value: AggregationMethod.SEGMENT_DWELL_TIME, label: 'Segment Dwell Time' },
] as const

export type TransitionMatrixAggregationMethodId = AggregationMethod

export function getAggregationMethodLabel(value: AggregationMethod): string {
  const method = TRANSITION_MATRIX_AGGREGATION_METHODS.find(
    m => m.value === value
  )
  return method?.label || value
}
