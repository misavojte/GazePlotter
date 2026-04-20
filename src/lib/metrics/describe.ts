/**
 * Self-describing surface for WebMCP / LLM consumers. Emits a JSON-friendly
 * description of every registered metric — recipe metadata, param schema,
 * legal leaf projections, and whether windowing is supported.
 */
import { listMetrics } from './registry'
import { getRecipe } from './core/defineMetric'
import type { Metric, OutputShape } from './core/dsl'
import {
  PROJECTION_LEAVES,
  type LeafKind,
  type LeafProjection,
} from './core/projection'
import { paramsSchemaFor } from './core/params'
import { recipeSupports } from './core/validation'

export interface MetricDescription {
  id: string
  label: string
  description: string
  unit: string
  category: string
  rawShape: OutputShape
  windowUnit: 'ms' | 'fixations'
  supportsWindowing: boolean
  searchTags: readonly string[]
  paramsSchema: Record<string, unknown>
  /** Leaf projection kinds this recipe accepts (before any rejects hook). */
  leaves: LeafKind[]
}

export function describeMetric(m: Metric): MetricDescription {
  const recipe = getRecipe(m.meta.id)
  const leaves: LeafKind[] = []
  for (const [kind, def] of Object.entries(PROJECTION_LEAVES) as [LeafKind, typeof PROJECTION_LEAVES[LeafKind]][]) {
    if (!def.rawShapes.includes(m.meta.rawShape)) continue
    if (recipe && recipeSupports(recipe, buildProbeLeaf(kind)) !== true) continue
    leaves.push(kind)
  }
  return {
    id: m.meta.id,
    label: m.meta.label,
    description: m.meta.description,
    unit: m.meta.unit,
    category: m.meta.category,
    rawShape: m.meta.rawShape,
    windowUnit: m.meta.windowUnit,
    supportsWindowing: m.meta.supportsWindowing,
    searchTags: m.meta.searchTags,
    paramsSchema: paramsSchemaFor(m.meta.params),
    leaves,
  }
}

export function describeMetricsForLLM(): MetricDescription[] {
  return listMetrics().map(describeMetric)
}

/** Representative leaf projection for probing the validator. Never executed. */
function buildProbeLeaf(kind: LeafKind): LeafProjection {
  const aoi = { by: 'name' as const, name: '__probe__' }
  switch (kind) {
    case 'identity-scalar':          return { kind }
    case 'identity-aoi-vector':      return { kind }
    case 'identity-aoi-pair-matrix': return { kind }
    case 'pick-aoi':         return { kind, aoiRef: aoi }
    case 'aggregate-aoi':    return { kind, reducer: 'mean' }
    case 'matrix-diagonal':  return { kind }
    case 'matrix-row':       return { kind, aoiRef: aoi }
    case 'matrix-col':       return { kind, aoiRef: aoi }
    case 'matrix-cell':      return { kind, fromAoi: aoi, toAoi: aoi }
    case 'matrix-aggregate': return { kind, reducer: 'mean' }
  }
}
