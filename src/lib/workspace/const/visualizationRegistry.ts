import ScarfPlot from '$lib/plots/scarf/components/ScarfPlot.svelte'
// Revert casing to lowercase 'a' based on linter "already included" message
import TransitionMatrixPlot from '$lib/plots/transition-matrix/components/TransitionMatrixPlot.svelte' // Use lowercase 'a'
import BarPlot from '$lib/plots/bar/components/BarPlot.svelte'
import AoiStreamPlot from '$lib/plots/aoi-stream/components/AoiStreamPlot.svelte'
import type { GridItemMap, AllGridTypes } from '$lib/workspace/type/gridType'
import { getScarfGridHeightFromCurrentData } from '$lib/plots/scarf/utils/scarfServices'

/**
 * Configuration type for visualization registry entries
 * Defines the structure for each visualization type in the registry
 */
export type VisualizationConfig<K extends keyof GridItemMap> = {
  name: string
  component: any // Ideally refine this to Component<GridItemMap[K]>
  getDefaultConfig: (params?: {
    stimulusId?: number
    groupId?: number
  }) => Partial<GridItemMap[K]>
  getDefaultHeight: (stimulusId?: number) => number
  getDefaultWidth: (stimulusId?: number) => number
}

/**
 * Visualization registry - a map of all available visualization types
 * Contains configuration for each supported visualization component
 * Use a mapped type so every visualization is forced to comply with its specific interface
 */
export const visualizationRegistry: {
  [K in keyof GridItemMap]: VisualizationConfig<K>
} = {
  scarf: {
    name: 'Scarf Plot',
    component: ScarfPlot,
    getDefaultConfig: (params = {}) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      // TypeScript now enforces these are valid ScarfGridType properties!
      timeline: 'absolute',
      absoluteStimuliLimits: [],
      ordinalStimuliLimits: [],
      dynamicAOI: true,
      min: { w: 14, h: 3 },
    }),
    getDefaultHeight: (stimulusId = 0) =>
      getScarfGridHeightFromCurrentData(stimulusId, false, -1),
    getDefaultWidth: () => 20,
  },
  TransitionMatrix: {
    name: 'Transition Matrix',
    component: TransitionMatrixPlot,
    getDefaultConfig: (params = {}) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      stimuliColorValueRanges: [],
      aggregationMethod: 'sum',
      belowMinColor: '#e0e0e0', // Default gray for values below minimum
      aboveMaxColor: '#e0e0e0', // Default gray for values above maximum
      showBelowMinLabels: false, // Don't show labels for values below minimum by default
      showAboveMaxLabels: false, // Don't show labels for values above maximum by default
      colorScale: ['#f7fbff', '#08306b'], // Default blue gradient
      min: { w: 12, h: 12 },
    }),
    getDefaultHeight: () => 12, // Default square size
    getDefaultWidth: () => 12,
  },
  barPlot: {
    name: 'Bar Plot',
    component: BarPlot,
    getDefaultConfig: (params = {}) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      barPlottingType: 'horizontal',
      sortBars: 'none',
      aggregationMethod: 'absoluteTime',
      min: { w: 12, h: 12 },
    }),
    getDefaultHeight: () => 12,
    getDefaultWidth: () => 12,
  },
  aoiStreamPlot: {
    name: 'Time-binned AOI Occupancy',
    component: AoiStreamPlot,
    getDefaultConfig: (params = {}) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      binCount: 200,
      absoluteStimuliLimits: [],
      min: { w: 12, h: 10 },
    }),
    getDefaultHeight: () => 12,
    getDefaultWidth: () => 12,
  },
  // Add other visualizations here...
}

/**
 * Helper function to get visualization config by type
 * @param type - The visualization type key
 * @returns The visualization configuration
 * @throws Error if the visualization type is not found
 */
export function getVizConfig<K extends keyof GridItemMap>(
  type: K
): VisualizationConfig<K> {
  return visualizationRegistry[type]
}

// Backwards compatibility alias
export const getVisualizationConfig = getVizConfig
