import { aoiStreamPlotDefinition } from './aoi-stream/definition'
import { barPlotDefinition } from './bar/definition'
import { scarfPlotDefinition } from './scarf/definition'
import { transitionMatrixDefinition } from './transition-matrix/definition'

export const plotRegistry = {
  scarf: scarfPlotDefinition,
  transitionMatrix: transitionMatrixDefinition,
  barPlot: barPlotDefinition,
  aoiStreamPlot: aoiStreamPlotDefinition,
} as const

const LEGACY_VISUALIZATION_TYPES = {
  TransitionMatrix: 'transitionMatrix',
} as const

type VisualizationType = keyof typeof plotRegistry
type LegacyVisualizationType = keyof typeof LEGACY_VISUALIZATION_TYPES

export function getVizConfig<K extends VisualizationType>(
  type: K
): (typeof plotRegistry)[K]
export function getVizConfig(
  type: LegacyVisualizationType
): (typeof plotRegistry)['transitionMatrix']
export function getVizConfig(
  type: VisualizationType | LegacyVisualizationType
) {
  const normalizedType =
    LEGACY_VISUALIZATION_TYPES[type as LegacyVisualizationType] ?? type
  return plotRegistry[normalizedType]
}
