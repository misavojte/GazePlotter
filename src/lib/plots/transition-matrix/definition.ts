import TransitionMatrixPlot from './components/TransitionMatrixPlot.svelte'
import ModalContentDownloadTransitionMatrix from '$lib/modals/export/components/ModalContentDownloadTransitionMatrix.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'
import type { TransitionMatrixPlotSettings } from './types'

export const transitionMatrixDefinition = definePlot<
  'transitionMatrix',
  TransitionMatrixPlotSettings
>({
  type: 'transitionMatrix',
  name: 'Transition Matrix',
  component: TransitionMatrixPlot,
  exportComponent: ModalContentDownloadTransitionMatrix,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    stimuliColorValueRanges: [],
    aggregationMethod: 'sum',
    belowMinColor: INACTIVE_COLOR,
    aboveMaxColor: INACTIVE_COLOR,
    showBelowMinLabels: false,
    showAboveMaxLabels: false,
    colorScale: [...PRESET_PALETTES.BLUE.colors],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
})
