import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { PlotSubtitleParts } from './definePlot'
import { aoiStreamPlotDefinition } from './aoi-stream/definition'
import { barPlotDefinition } from './bar/definition'
import { scarfPlotDefinition } from './scarf/definition'
import { transitionMatrixDefinition } from './transition-matrix/definition'
import { scanpathSimilarityDefinition } from './scanpath-similarity/definition'
import { recurrencePlotDefinition } from './recurrence/definition'
import { evolvingMetricsDefinition } from './evolving-metrics/definition'
import { metricCorrelationDefinition } from './metric-correlation/definition'

export const plotRegistry = {
  scarf: scarfPlotDefinition,
  transitionMatrix: transitionMatrixDefinition,
  barPlot: barPlotDefinition,
  aoiStreamPlot: aoiStreamPlotDefinition,
  scanpathSimilarity: scanpathSimilarityDefinition,
  recurrencePlot: recurrencePlotDefinition,
  evolvingMetrics: evolvingMetricsDefinition,
  metricCorrelation: metricCorrelationDefinition,
} as const

export const LEGACY_VISUALIZATION_TYPES = {
  TransitionMatrix: 'transitionMatrix',
} as const

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
  item: { type: string; settings: unknown; id: number; x: number; y: number; w: number; h: number; min: { w: number; h: number }; redrawTimestamp: number },
  engine: DataEngine
): PlotSubtitleParts | undefined {
  const normalizedType = normalizeVisualizationType(item.type)
  if (!normalizedType) return undefined
  const def = plotRegistry[normalizedType] as {
    getSubtitle?: (params: { item: unknown; engine: DataEngine }) => PlotSubtitleParts | undefined
  }
  return def.getSubtitle?.({ item, engine })
}
