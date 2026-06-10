import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { PlotSubtitleParts, PlotItemContract, PlotDefinition } from './definePlot'
import { aoiStreamPlotDefinition } from './aoi-stream/definition'
import { barPlotDefinition } from './bar/definition'
import { scarfPlotDefinition } from './scarf/definition'
import { transitionMatrixDefinition } from './transition-matrix/definition'
import { scanpathSimilarityDefinition } from './scanpath-similarity/definition'
import { scanpathPlotDefinition } from './scanpath/definition'
import { recurrencePlotDefinition } from './recurrence/definition'
import { evolvingMetricsDefinition } from './evolving-metrics/definition'
import { metricCorrelationDefinition } from './metric-correlation/definition'

export const plotRegistry = {
  scarf: scarfPlotDefinition,
  transitionMatrix: transitionMatrixDefinition,
  barPlot: barPlotDefinition,
  aoiStreamPlot: aoiStreamPlotDefinition,
  scanpathSimilarity: scanpathSimilarityDefinition,
  scanpath: scanpathPlotDefinition,
  recurrencePlot: recurrencePlotDefinition,
  evolvingMetrics: evolvingMetricsDefinition,
  metricCorrelation: metricCorrelationDefinition,
} as const

export { LEGACY_VISUALIZATION_TYPES } from './legacyTypes'
import { LEGACY_VISUALIZATION_TYPES } from './legacyTypes'

type VisualizationType = keyof typeof plotRegistry
type LegacyVisualizationType = keyof typeof LEGACY_VISUALIZATION_TYPES
type AnyVisualizationType = VisualizationType | LegacyVisualizationType
type RegisteredPlotDefinition = (typeof plotRegistry)[VisualizationType]
export type PlotHostComponent = Component<{ item: unknown }>

function normalizeVisualizationType(
  type: AnyVisualizationType | string
): VisualizationType | null {
  const normalizedType =
    LEGACY_VISUALIZATION_TYPES[type as LegacyVisualizationType] ?? type

  return normalizedType in plotRegistry
    ? (normalizedType as VisualizationType)
    : null
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

export function resolvePlotComponent(type: string): PlotHostComponent {
  return resolvePlotDefinition(type).component as PlotHostComponent
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
