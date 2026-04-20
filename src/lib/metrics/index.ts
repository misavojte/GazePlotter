import './init'

// ─── Author surface ─────────────────────────────────────────────────────────
export { defineMetric } from './core/defineMetric'
export {
  extractFixationSequence,
  computeSequenceScalar,
} from './core/fixations'
export { integerParam, numberParam, boolParam, enumParam } from './core/params'
export {
  computeRqa,
  computeRqaWithDuration,
  computeRqaFromSequence,
  rqaScalar,
  buildCategoricalRecurrenceMatrix,
  buildDiagonalLineMask,
  buildHorizontalLineMask,
  buildVerticalLineMask,
} from './core/rqa'
export { defineCategory } from './categories'

// ─── Consumer surface ──────────────────────────────────────────────────────
export { query, queryBatch, queryGroup, queryIndividuals } from './query'
export {
  getMetric,
  listMetrics,
  listByCategory,
  listCategories,
  getCategory,
  getCategoryOrder,
  getCategoryLabels,
} from './registry'
export {
  buildStarterInstances,
  createSystemMetricInstances,
  createDefaultWindowedInstances,
  createDefaultAoiPairInstances,
  createDefaultMetricInstances,
  findSystemInstanceIdByBaseId,
  reconcileSystemInstances,
  nextInstanceId,
  resolveInstance,
  resolveInstanceWithFallback,
  defaultInstanceLabel,
  formatParamReadout,
  formatProjectionReadout,
  makeLeafInstance,
} from './instances'

// ─── Projection surface ────────────────────────────────────────────────────
export {
  PROJECTION_LEAVES,
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
export { ProjectionSchema, LeafProjectionSchema, WindowSpecSchema } from './core/schemas'
export { paramToJsonSchema, paramsSchemaFor } from './core/params'
export { describeMetricsForLLM } from './describe'

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  Metric,
  MetricMeta,
  MetricRecipe,
  AoiSlotInfo,
  FixationEvent,
  OutputShape,
  WindowUnit,
  StarterSpec,
} from './core/dsl'
export type { ParamDef, ParamType, ParamsOf } from './core/params'
export type { MetricInstance } from './instances'
export type { MetricResult, MetricProvenance, Scope, GroupScope } from './query'
export type { MetricCategoryDef } from './categories'
export type { RqaResult } from './core/rqa'
export type { FixationSequence } from './core/fixations'

// ─── Plot contract + filters ───────────────────────────────────────────────
export {
  instanceMatchesContract,
  metricIsCreatableInContract,
  metricsForPlot,
} from './filters'
export type { PlotMetricContract } from './filters'

// ─── UI ────────────────────────────────────────────────────────────────────
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
