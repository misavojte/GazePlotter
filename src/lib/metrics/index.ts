import './init'

// ─── Author surface (for metric definition files) ──────────────────────────
export { extractFixationSequence } from './core/fixations'

// ─── Consumer surface (what plots + export pipelines call at runtime) ──────
export {
  query,
  queryBatch,
  queryGroup,
  queryIndividualsAllSlots,
  queryPooledIndividuals,
} from './query'
export { getMetric } from './core/defineMetric'
// The canonical eye-movement-type axis (order contract for category-vector
// results, pick-category options, and per-type consumers).
export { categoryGroups, categoryGroupNames } from './core/categoryScan'
// The canonical per-stimulus event axis (order contract for event-vector
// results, pick-event options, and per-channel consumers).
export { eventGroups, eventGroupNames, eventGroupNamesUnion } from './core/eventScan'
export {
  createDefaultMetricInstances,
  createMetricInstance,
  resolveInstance,
  defaultInstanceLabel,
  formatParamReadout,
  formatProjectionReadout,
  reductionQualifier,
  resolveReduction,
  instanceReadout,
  instanceDetailLine,
} from './instances'

// ─── Projection algebra (for the metric-library modal) ─────────────────────
export {
  projectionOutputShape,
  windowLabel,
} from './core/projection'

// ─── Capability algebra (measurement nature + cross-participant aggregation) ─
export {
  soundReductions,
  reducesAcrossParticipants,
  distributionStatistics,
  supportedMatrixReducers,
} from './core/measurement'
export type { MeasurementClass, GroupReduction } from './core/measurement'
export { reduceFinite, effectiveReduction, reductionLabel } from './core/aggregation'
export type {
  Projection,
  ProjectionLabelPart,
  WindowedProjection,
  WindowSpec,
} from './core/projection'

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  Metric,
  AoiSlotInfo,
} from './core/dsl'
export type { MetricInstance } from './instances'
export type { MetricResult, MetricProvenance, Scope, GroupScope } from './query'

// ─── Plot contract + filters ───────────────────────────────────────────────
export {
  instanceMatchesContract,
  metricIsCreatableInContract,
  metricLeafKindsInContract,
  datasetCanFeed,
  contractReductions,
  contractDistributionStats,
} from './filters'
export type { PlotMetricContract } from './filters'

// ─── UI ────────────────────────────────────────────────────────────────────
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
