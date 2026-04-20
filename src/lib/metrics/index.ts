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
  createSystemMetricInstances,
  createDefaultMetricInstances,
  createDefaultWindowedInstances,
  createDefaultAoiPairInstances,
  findSystemInstanceIdByBaseId,
  reconcileSystemInstances,
  nextInstanceId,
  resolveInstance,
  resolveInstanceWithFallback,
  defaultInstanceLabel,
  formatParamReadout,
  formatWindowingReadout,
  formatProjectionReadout,
} from './instances'

// ─── Projection surface ────────────────────────────────────────────────────
export {
  IDENTITY_PROJECTION,
  identityFor,
  applyProjection,
  computeEffectiveShape,
  targetsFor,
  fromMethodsFor,
  isProjectionValid,
  projectionToLabel,
  projectionKey,
} from './core/projection'
// Validation (cooking-system guardrails)
export { validateCombination, validateProjectionForUnit } from './core/validation'
export type { ValidationInput, ValidationResult } from './core/validation'
export type {
  Projection,
  ProjectionShape,
  AoiRef,
  AoiReducer,
  MatrixReducer,
} from './core/projection'
export { ProjectionSchema, WindowingConfigSchema } from './core/schemas'
export { paramToJsonSchema, paramsSchemaFor } from './core/params'
export { describeMetricsForLLM } from './describe'

// ─── Types ─────────────────────────────────────────────────────────────────
export type {
  Metric,
  MetricMeta,
  MetricRecipe,
  WindowingConfig,
  AoiSlotInfo,
  FixationEvent,
  OutputShape,
  WindowUnit,
  ComputationMode,
  Reduction,
} from './core/dsl'
export type { ParamDef, ParamType, ParamsOf } from './core/params'
export type { MetricInstance } from './instances'
export type { MetricResult, MetricProvenance, Scope, GroupScope } from './query'
export type { MetricCategoryDef } from './categories'
export type { RqaResult } from './core/rqa'
export type { FixationSequence } from './core/fixations'

// ─── Context (who consumes what) ───────────────────────────────────────────
export {
  instanceMatchesContext,
  metricIsCreatableInContext,
  METRIC_CONTEXTS,
} from './context'
export type { MetricContext } from './context'

// ─── UI ────────────────────────────────────────────────────────────────────
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
