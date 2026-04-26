import './init'

// ─── Author surface (for metric definition files) ──────────────────────────
export { defineMetric } from './core/defineMetric'
export { defineCategory } from './categories'
export { extractFixationSequence } from './core/fixations'
export { integerParam, numberParam, boolParam, enumParam } from './core/params'
export { computeRqa, rqaScalar } from './core/rqa'

// ─── Consumer surface (what plots + export pipelines call at runtime) ──────
export { query, queryBatch, queryGroup, queryIndividuals } from './query'
export { getMetric, listMetrics } from './core/defineMetric'
export { getCategoryLabels } from './categories'
export {
  buildStarterInstances,
  createDefaultMetricInstances,
  resolveInstance,
  defaultInstanceLabel,
  formatParamReadout,
  formatProjectionReadout,
} from './instances'
export { STARTING_METRICS } from './startingMetrics'
export type { StartingMetricSpec } from './startingMetrics'

// ─── Projection algebra (for the metric-library modal) ─────────────────────
export {
  PROJECTION_LEAVES,
  AOI_REDUCERS,
  MATRIX_REDUCERS,
  applyProjection,
  projectionOutputShape,
  projectionToLabel,
  projectionCacheKey,
  identityFor,
  leafOf,
  leafOutputShape,
  leafRawShapes,
  windowLabel,
  windowKey,
} from './core/projection'
export { recipeSupports } from './core/validation'
export type { ValidationResult } from './core/validation'
export type {
  Projection,
  LeafProjection,
  WindowedProjection,
  LeafKind,
  ProjectionKind,
  LeafKindDef,
  ApplyContext,
  ApplyResult,
  AoiRef,
  AoiReducer,
  MatrixReducer,
  WindowSpec,
} from './core/projection'

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  Metric,
  MetricMeta,
  MetricRecipe,
  AoiSlotInfo,
  FixationEvent,
  OutputShape,
  WindowUnit,
} from './core/dsl'
export type { ParamDef, ParamType, ParamsOf } from './core/params'
export type { MetricInstance } from './instances'
export type { MetricResult, MetricProvenance, Scope, GroupScope } from './query'
export type { MetricCategoryDef } from './categories'

// ─── Plot contract + filters ───────────────────────────────────────────────
export {
  instanceMatchesContract,
  metricIsCreatableInContract,
  contractLeafKinds,
} from './filters'
export type { PlotMetricContract } from './filters'

// ─── UI ────────────────────────────────────────────────────────────────────
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
