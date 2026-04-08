import BarPlot from './components/BarPlot.svelte'
import BarPlotExportFigure from './components/BarPlotExportFigure.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { BarPlotSettings } from './types'

export const barPlotDefinition = definePlot<'barPlot', BarPlotSettings>({
  type: 'barPlot',
  name: 'Bar Plot',
  component: BarPlot,
  export: { figure: BarPlotExportFigure },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    barPlottingType: 'horizontal',
    orderBy: 'aoi',
    orderDirection: 'asc',
    aggregationMethod: 'absoluteTime',
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
})
