import AoiStreamPlot from './components/AoiStreamPlot.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { AoiStreamPlotSettings } from './types'

export const aoiStreamPlotDefinition = definePlot<
  'aoiStreamPlot',
  AoiStreamPlotSettings
>({
  type: 'aoiStreamPlot',
  name: 'Time-binned AOI Occupancy',
  component: AoiStreamPlot,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    binSize: 500,
    absoluteStimuliLimits: [],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
})
