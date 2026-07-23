import './init'

// ─── Author surface (for metric definition files) ──────────────────────────
export { extractFixationSequence } from './core/fixations'

// ─── Consumer surface (what plots + export pipelines call at runtime) ──────
export { query, queryBatch, queryGroup, queryIndividualsAllSlots } from './query'
export { getMetric } from './core/defineMetric'
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
} from './instances'

// ─── Projection algebra (for the metric-library modal) ─────────────────────
export {
  projectionOutputShape,
  supportedLeaves,
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
  contractReductions,
  contractDistributionStats,
} from './filters'
export type { PlotMetricContract } from './filters'

// ─── UI ────────────────────────────────────────────────────────────────────
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
