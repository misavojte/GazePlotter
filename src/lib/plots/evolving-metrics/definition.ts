import EvolvingMetricsPlot from './components/EvolvingMetricsPlot.svelte'
import EvolvingMetricsExportFigure from './components/EvolvingMetricsExportFigure.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { EvolvingMetricsSettings } from './types'

export const evolvingMetricsDefinition = definePlot<
  'evolvingMetrics',
  EvolvingMetricsSettings
>({
  type: 'evolvingMetrics',
  name: 'Evolving Metrics',
  component: EvolvingMetricsPlot,
  export: { figure: EvolvingMetricsExportFigure },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    stepSize: 100,
    windowMultiplier: 1,
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 14,
  getDefaultWidth: () => 14,
  requireCapabilities: ['segmented'],
})
