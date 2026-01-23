import ScarfPlot from '$lib/plots/scarf/components/ScarfPlot.svelte'
import TransitionMatrixPlot from '$lib/plots/transition-matrix/components/TransitionMatrixPlot.svelte'
import BarPlot from '$lib/plots/bar/components/BarPlot.svelte'
import AoiStreamPlot from '$lib/plots/aoi-stream/components/AoiStreamPlot.svelte'
import type {
  GridItemMap,
  VisualizationConfig,
} from '$lib/workspace/type/gridType'

/**
 * Visualization registry - a map of all available visualization types.
 * Serves as a central catalog for the plots package.
 */
export const registry: {
  [K in keyof GridItemMap]: VisualizationConfig<K>
} = {
  scarf: {
    name: 'Scarf Plot',
    component: ScarfPlot,
    getDefaultConfig: (params = {}) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      timeline: 'absolute',
      absoluteStimuliLimits: [],
      ordinalStimuliLimits: [],
      dynamicAOI: true,
      min: { w: 14, h: 3 },
    }),
    getDefaultHeight: () => 12,
    getDefaultWidth: () => 20,
  },
  transitionMatrix: {
    name: 'Transition Matrix',
    component: TransitionMatrixPlot,
    getDefaultConfig: (params = {}) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      stimuliColorValueRanges: [],
      aggregationMethod: 'sum',
      belowMinColor: '#e0e0e0',
      aboveMaxColor: '#e0e0e0',
      showBelowMinLabels: false,
      showAboveMaxLabels: false,
      colorScale: ['#f7fbff', '#08306b'],
      min: { w: 11, h: 12 },
    }),
    getDefaultHeight: () => 12,
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
      min: { w: 11, h: 12 },
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
      min: { w: 11, h: 10 },
    }),
    getDefaultHeight: () => 12,
    getDefaultWidth: () => 12,
  },
}

/**
 * Helper function to get visualization config by type
 */
export function getVizConfig<K extends keyof GridItemMap>(
  type: K
): VisualizationConfig<K> {
  // Backward compatibility for old PascalCase type IDs
  const normalizedType =
    type === ('TransitionMatrix' as any) ? 'transitionMatrix' : type
  return registry[normalizedType as K]
}

// Alias for transition registry if visualizationRegistry is preferred as a name in some contexts
export const visualizationRegistry = registry
