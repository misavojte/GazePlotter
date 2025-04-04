import ScarfPlot from '$lib/components/Plot/ScarfPlot/ScarfPlot.svelte'
// Revert casing to lowercase 'a' based on linter "already included" message
import AoiTransitionMatrixPlot from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixPlot.svelte' // Use lowercase 'a'
import type { AllGridTypes } from '$lib/type/gridType'
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
      absoluteGeneralLimits: [0, 0],
      absoluteStimuliLimits: [],
      ordinalGeneralLimits: [0, 0],
      ordinalStimuliLimits: [],
      dynamicAOI: true,
      min: { w: 14, h: 3 },
    }),
    getDefaultHeight: (stimulusId = 0) =>
      getScarfGridHeightFromCurrentData(stimulusId, false, -1),
    getDefaultWidth: (_stimulusId = 0) => 20, // Renamed unused parameter
  },
  AoiTransitionMatrix: {
    name: 'AOI Transition Matrix',
    component: AoiTransitionMatrixPlot,
    getDefaultConfig: (
      params: { stimulusId?: number; groupId?: number } = {}
    ) => ({
      stimulusId: params.stimulusId ?? 0,
      groupId: params.groupId ?? -1,
      min: { w: 11, h: 12 },
    }),
    getDefaultHeight: () => 12, // Default square size
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
