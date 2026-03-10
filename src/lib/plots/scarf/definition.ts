import ScarfPlot from './components/ScarfPlot.svelte'
import ModalContentDownloadScarfPlot from '$lib/modals/export/components/ModalContentDownloadScarfPlot.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { ScarfPlotSettings } from './types'

export const scarfPlotDefinition = definePlot<'scarf', ScarfPlotSettings>({
  type: 'scarf',
  name: 'Scarf Plot',
  component: ScarfPlot,
  exportComponent: ModalContentDownloadScarfPlot,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    timeline: 'absolute',
    absoluteStimuliLimits: [],
    ordinalStimuliLimits: [],
    dynamicAOI: true,
  }),
  getMinSize: () => ({ w: 14, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 20,
})
