import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type {
  PlotSubtitleParts,
  PlotItemContract,
  PlotDefinition,
  PlotRuntime,
  PaneSectionEntry,
} from './definePlot'
import type { PlotSettingsMap } from '$lib/workspace/grid/types'
import { aoiStreamPlotDefinition } from './aoi-stream'
import { aoiComparisonDefinition } from './aoi-comparison'
import { scarfPlotDefinition } from './scarf'
import { transitionMatrixDefinition } from './transition-matrix'
import { scanpathSimilarityDefinition } from './scanpath-similarity'
import { scanpathPlotDefinition } from './scanpath'
import { fixationHeatmapDefinition } from './fixation-heatmap'
import { recurrencePlotDefinition } from './recurrence'
import { evolvingMetricsDefinition } from './evolving-metrics'
import { metricCorrelationDefinition } from './metric-correlation'
import { metricMatrixDefinition } from './metric-matrix'
import { eyeMovementComparisonDefinition } from './eye-movement-comparison'
import { eventComparisonDefinition } from './event-comparison'

export const plotRegistry = {
  // Add-visualization menu order within each group.
  fixationHeatmap: fixationHeatmapDefinition,
  scanpath: scanpathPlotDefinition,
  scarf: scarfPlotDefinition,
  transitionMatrix: transitionMatrixDefinition,
  recurrencePlot: recurrencePlotDefinition,
  scanpathSimilarity: scanpathSimilarityDefinition,
  aoiComparison: aoiComparisonDefinition,
  aoiStreamPlot: aoiStreamPlotDefinition,
  eyeMovementComparison: eyeMovementComparisonDefinition,
  eventComparison: eventComparisonDefinition,
  evolvingMetrics: evolvingMetricsDefinition,
  metricMatrix: metricMatrixDefinition,
  metricCorrelation: metricCorrelationDefinition,
} as const

/**
 * Schema pane sections are a mandatory declarative contract — validated at
 * registration like the metric DSL's trio/scanGroup invariant, so a malformed
 * schema fails on first import instead of rendering a broken pane:
 *   - schema section keys must be plot-namespaced (`type:section`);
 *   - field keys are unique within a section;
 *   - every field is backed by `getDefaultSettings()` or carries a `default`
 *     (colorScale carries its defaults as the min/max pair);
 *   - a static enum default must be one of its options.
 */
function assertSettingsSchema(def: {
  type: string
  getDefaultSettings: () => unknown
  paneSections: PaneSectionEntry[]
}): void {
  const defaults = def.getDefaultSettings() as Record<string, unknown>
  for (const entry of def.paneSections) {
    if (typeof entry === 'string' || !('fields' in entry)) continue
    const where = `[plots] ${def.type} pane section "${entry.key}"`
    if (!entry.key.includes(':')) {
      throw new Error(
        `${where}: schema section keys must be namespaced ("${def.type}:...")`
      )
    }
    const seen = new Set<string>()
    for (const field of entry.fields) {
      // Display-only fields have no settings key to validate.
      if (field.kind === 'info') continue
      if (seen.has(field.key)) {
        throw new Error(`${where}: duplicate schema field "${field.key}"`)
      }
      seen.add(field.key)
      const hasDefault =
        field.kind === 'colorScale' ||
        ('default' in field && field.default !== undefined)
      if (!(field.key in defaults) && !hasDefault) {
        throw new Error(
          `${where}: field "${field.key}" is neither in getDefaultSettings() nor carries a default`
        )
      }
      if (
        field.kind === 'enum' &&
        field.default !== undefined &&
        typeof field.options !== 'function' &&
        !field.options.some(o => o.value === field.default)
      ) {
        throw new Error(
          `${where}: enum "${field.key}" default "${field.default}" is not one of its options`
        )
      }
    }
  }
}

// Lazily-once on first registry use, NOT at module scope: definition modules
// and the registry sit in import cycles (definition → sections → … →
// itemFactory → registry), so an eager loop could observe a definition export
// still in its temporal dead zone. Any real flow resolves a plot type
// immediately, so a malformed schema still fails on first use.
let settingsSchemasValidated = false
export function ensureSettingsSchemasValid(): void {
  if (settingsSchemasValidated) return
  settingsSchemasValidated = true
  for (const def of Object.values(plotRegistry)) {
    assertSettingsSchema(def)
  }
}

import { LEGACY_VISUALIZATION_TYPES } from '$lib/data/ingest/workspace/legacyPlotTypes'

type VisualizationType = keyof typeof plotRegistry
type LegacyVisualizationType = keyof typeof LEGACY_VISUALIZATION_TYPES
type AnyVisualizationType = VisualizationType | LegacyVisualizationType
type RegisteredPlotDefinition = (typeof plotRegistry)[VisualizationType]

function normalizeVisualizationType(
  type: AnyVisualizationType | string
): VisualizationType | null {
  ensureSettingsSchemasValid()
  const normalizedType =
    LEGACY_VISUALIZATION_TYPES[type as LegacyVisualizationType] ?? type

  return normalizedType in plotRegistry
    ? (normalizedType as VisualizationType)
    : null
}

/**
 * Every plot's runtime over its own settings, as a mapped type: indexed by a
 * generic `K`, a definition and its item's settings stay correlated, so the
 * generic hosts call `deriveView` without a cast.
 */
type PlotRuntimeMap = { [K in VisualizationType]: PlotRuntime<PlotSettingsMap[K]> }
const plotRuntimes: PlotRuntimeMap = plotRegistry

export function resolvePlotRuntime<K extends VisualizationType>(type: K): PlotRuntimeMap[K] {
  ensureSettingsSchemasValid()
  const runtime = plotRuntimes[type]
  if (!runtime) throw new Error(`Plot type "${type}" is not registered.`)
  return runtime
}

export function getVizConfig<K extends VisualizationType>(
  type: K
): (typeof plotRegistry)[K]
export function getVizConfig(
  type: LegacyVisualizationType
): (typeof plotRegistry)['transitionMatrix']
export function getVizConfig(
  type: AnyVisualizationType
) {
  const normalizedType = normalizeVisualizationType(type)
  return normalizedType ? plotRegistry[normalizedType] : undefined
}

export function resolvePlotDefinition(type: string): RegisteredPlotDefinition {
  const plotDefinition = normalizeVisualizationType(type)

  if (!plotDefinition) {
    throw new Error(`Plot type "${type}" is not registered.`)
  }

  return plotRegistry[plotDefinition]
}

export function getPlotDisplayName(type: string): string {
  const normalizedType = normalizeVisualizationType(type)
  return normalizedType ? plotRegistry[normalizedType].name : type
}

export function getPlotSubtitle(
  item: PlotItemContract<string, unknown>,
  engine: DataEngine
): PlotSubtitleParts | undefined {
  const normalizedType = normalizeVisualizationType(item.type)
  if (!normalizedType) return undefined
  const def = plotRegistry[normalizedType] as PlotDefinition<string, any>
  return def.getSubtitle?.({ item, engine })
}
