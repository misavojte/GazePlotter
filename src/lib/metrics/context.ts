import type { Metric, OutputShape } from './core/dsl'
import type { MetricInstance } from './instances'
import { getMetric } from './registry'

/**
 * Descriptor of what metric instances a UI surface (plot pane, library
 * modal) accepts. One descriptor drives both the dropdown filter and the
 * "Create new" list — eliminates the need for each pane to reimplement
 * the same shape/windowing predicate.
 */
export type MetricContext = {
  /** Output shapes this consumer accepts. */
  shapes: readonly OutputShape[]
  /** 'never' = only non-windowed instances; 'only' = only windowed. */
  windowing: 'never' | 'only'
  /** Dropdown UX: multi-select (checkboxes) vs single-select (radios). */
  multiSelect?: boolean
}

/** Does an existing instance belong in this context? */
export function instanceMatchesContext(
  instance: MetricInstance,
  ctx: MetricContext,
): boolean {
  const shape = getMetric(instance.baseId)?.meta.outputShape
  if (!shape || !ctx.shapes.includes(shape)) return false
  const hasWindowing = !!instance.windowing
  return ctx.windowing === 'only' ? hasWindowing : !hasWindowing
}

/** Can a metric definition be instantiated via this context's "Create" UI? */
export function metricIsCreatableInContext(
  metric: Metric,
  ctx: MetricContext,
): boolean {
  if (!ctx.shapes.includes(metric.meta.outputShape)) return false
  if (ctx.windowing === 'only') {
    return metric.meta.computationModes.some(m => m !== 'global')
  }
  return true
}

/** Canonical contexts used by the built-in plots. */
export const METRIC_CONTEXTS = {
  /** Single aoi-vector metric (bar plot). */
  aoiVector: {
    shapes: ['aoi-vector'],
    windowing: 'never',
    multiSelect: false,
  },
  /** Single aoi-pair-matrix metric (transition matrix). */
  aoiPair: {
    shapes: ['aoi-pair-matrix'],
    windowing: 'never',
    multiSelect: false,
  },
  /** Multiple scalar+aoi-vector metrics (metric correlation). */
  globalMulti: {
    shapes: ['scalar', 'aoi-vector'],
    windowing: 'never',
    multiSelect: true,
  },
  /** Single windowed metric, any non-pair shape (evolving metrics). */
  windowed: {
    shapes: ['scalar', 'aoi-vector'],
    windowing: 'only',
    multiSelect: false,
  },
} as const satisfies Record<string, MetricContext>
