import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
// Revert casing to lowercase 'a' based on linter "already included" message
import TransitionMatrixPlot from '$lib/components/Plot/TransitionMatrixPlot/TransitionMatrixPlot.svelte' // Use lowercase 'a'
import BarPlot from '$lib/components/Plot/BarPlot/BarPlot.svelte'
import type { AllGridTypes, BarPlotGridType } from '$lib/type/gridType'
import { getScarfGridHeightFromCurrentData } from '$lib/services/scarfServices'
// Define a type for visualization registry entries
export type VisualizationConfig = {
  name: string
  component: any // Using 'any' here for simplicity, could be refined
  getDefaultConfig: (params?: any) => Partial<AllGridTypes>
  getDefaultHeight: (params?: any) => number
  getDefaultWidth: (params?: any) => number
}

// Visualization registry - a map of all available visualization types
export const visualizationRegistry: Record<string, VisualizationConfig> = {
  scarf: {
    name: 'Scarf Plot',
    component: ScarfPlot,
    getDefaultConfig: (
      params: { stimulusId?: number; groupId?: number } = {}
    ) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      zoomLevel: 0,
      timeline: 'absolute',
      absoluteStimuliLimits: [],
      ordinalStimuliLimits: [],
      dynamicAOI: true,
      min: { w: 14, h: 3 },
    }),
    getDefaultHeight: (stimulusId = 0) =>
      getScarfGridHeightFromCurrentData(stimulusId, false, -1),
    getDefaultWidth: (_stimulusId = 0) => 20, // Renamed unused parameter
  },
  TransitionMatrix: {
    name: 'Transition Matrix',
    component: TransitionMatrixPlot,
    getDefaultConfig: (
      params: { stimulusId?: number; groupId?: number } = {}
    ) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      stimuliColorValueRanges: [],
      aggregationMethod: 'sum',
      belowMinColor: '#e0e0e0', // Default gray for values below minimum
      aboveMaxColor: '#e0e0e0', // Default gray for values above maximum
      showBelowMinLabels: false, // Don't show labels for values below minimum by default
      showAboveMaxLabels: false, // Don't show labels for values above maximum by default
      colorScale: ['#f7fbff', '#08306b'], // Default blue gradient
      min: { w: 11, h: 12 },
    }),
    getDefaultHeight: () => 12, // Default square size
    getDefaultWidth: () => 12,
  },
  barPlot: {
    name: 'Bar Plot',
    component: BarPlot,
    getDefaultConfig: (
      params: { stimulusId?: number; groupId?: number } = {}
    ) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      barPlottingType: 'vertical',
      sortBars: 'none',
      aggregationMethod: 'absoluteTime',
      min: { w: 12, h: 12 },
    }),
    getDefaultHeight: () => 12,
    getDefaultWidth: () => 12,
  },
  // Add other visualizations here...
}

// Helper function to get visualization config
export const getVisualizationConfig = (type: string): VisualizationConfig => {
  const config = visualizationRegistry[type]
  if (!config) {
    // Consider more robust error handling or a default fallback
    throw new Error(`Visualization config not found for type: ${type}`)
  }
  return config
}
