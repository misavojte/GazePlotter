import './init'

// ─── Author surface ─────────────────────────────────────────────────────────
export { defineMetric } from './core/defineMetric'
export { extractFixationSequence, computeSequenceScalar } from './core/fixations'
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
export { getMetric, listMetrics, listByCategory, listCategories, getCategory, getCategoryOrder, getCategoryLabels } from './registry'
export {
  createSystemMetricInstances,
  createDefaultMetricInstances,
  createDefaultWindowedInstances,
  findSystemInstanceIdByBaseId,
  reconcileSystemInstances,
  nextInstanceId,
  resolveInstance,
  defaultInstanceLabel,
  formatParamReadout,
  formatWindowingReadout,
} from './instances'

// ─── Types ─────────────────────────────────────────────────────────────────
export type { Metric, MetricMeta, MetricRecipe, WindowingConfig, AoiSlotInfo, FixationEvent, OutputShape, WindowUnit, ComputationMode, Reduction } from './core/dsl'
export type { ParamDef, ParamType, ParamsOf } from './core/params'
export type { MetricInstance } from './instances'
export type { MetricResult, Scope, GroupScope } from './query'
export type { MetricCategoryDef } from './categories'
export type { RqaResult } from './core/rqa'
export type { FixationSequence } from './core/fixations'

// ─── UI ────────────────────────────────────────────────────────────────────
export { default as MetricSelect } from './components/MetricSelect.svelte'
export { metricLibraryModal } from '$lib/modals/definitions'
