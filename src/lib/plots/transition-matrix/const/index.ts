/**
 * Defines available aggregation methods for transition matrices
 */
export enum AggregationMethod {
  SUM = 'sum',
  PROBABILITY = 'probability',
  PROBABILITY_2 = 'probability2',
  PROBABILITY_3 = 'probability3',
  DWELL_TIME = 'dwellTime',
  SEGMENT_DWELL_TIME = 'segmentDwellTime',
}
