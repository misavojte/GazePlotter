/**
 * Self-describing surface for WebMCP / LLM consumers. Emits a JSON-friendly
 * description of every registered metric — recipe metadata, param schema,
 * legal projections, and the effective output shape each projection yields.
 */
import { listMetrics } from './registry'
import { getRecipe } from './core/defineMetric'
import type { Metric, OutputShape } from './core/dsl'
import {
  targetsFor,
  fromMethodsFor,
  type Projection,
  type ProjectionShape,
} from './core/projection'
import { paramsSchemaFor } from './core/params'
import { validateCombination } from './core/validation'

export interface MetricDescription {
  id: string
  label: string
  description: string
  unit: string
  category: string
  outputShape: OutputShape
  windowUnit: 'ms' | 'fixations'
  computationModes: readonly string[]
  searchTags: readonly string[]
  paramsSchema: Record<string, unknown>
  /** Every legal (target, from) pair this recipe supports. */
  projections: Array<{ target: ProjectionShape; from: Projection['from'] }>
}

export function describeMetric(m: Metric): MetricDescription {
  const raw = m.meta.outputShape
  const recipe = getRecipe(m.meta.id)
  const projections: MetricDescription['projections'] = []
  for (const target of targetsFor(raw)) {
    for (const from of fromMethodsFor(raw, target)) {
      // Skip validator-rejected (projection, from) pairs so the MCP-ready
      // surface mirrors the UI. We probe with a representative constructor
      // for method-specific params; validator rules don't depend on AoiRef
      // contents, only on projection.target/from/reducer.
      const probe = buildProbeProjection(target, from)
      if (recipe && !validateCombination({ recipe, projection: probe }).ok) continue
      projections.push({ target, from })
    }
  }
  return {
    id: m.meta.id,
    label: m.meta.label,
    description: m.meta.description,
    unit: m.meta.unit,
    category: m.meta.category,
    outputShape: raw,
    windowUnit: m.meta.windowUnit,
    computationModes: m.meta.computationModes,
    searchTags: m.meta.searchTags,
    paramsSchema: paramsSchemaFor(m.meta.params),
    projections,
  }
}

export function describeMetricsForLLM(): MetricDescription[] {
  return listMetrics().map(describeMetric)
}

/** Representative projection for validator probing — concrete enough for
 *  rule evaluation, never actually executed. */
function buildProbeProjection(
  target: ProjectionShape,
  from: Projection['from']
): Projection {
  const aoi = { by: 'name' as const, name: '__probe__' }
  if (target === 'scalar') {
    if (from === 'identity')         return { target, from }
    if (from === 'pick-aoi')         return { target, from, aoiRef: aoi }
    if (from === 'aggregate-aoi')    return { target, from, reducer: 'mean' }
    if (from === 'matrix-aggregate') return { target, from, reducer: 'mean' }
    if (from === 'matrix-cell')      return { target, from, fromAoi: aoi, toAoi: aoi }
  }
  if (target === 'aoi-vector') {
    if (from === 'identity')        return { target, from }
    if (from === 'matrix-diagonal') return { target, from }
    if (from === 'matrix-row')      return { target, from, aoiRef: aoi }
    if (from === 'matrix-col')      return { target, from, aoiRef: aoi }
  }
  return { target: 'aoi-pair-matrix', from: 'identity' }
}
