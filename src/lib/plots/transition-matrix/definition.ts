import TransitionMatrixPlot from './components/TransitionMatrixPlot.svelte'
import TransitionMatrixExportFigure from './components/TransitionMatrixExportFigure.svelte'
import TransitionMatrixPlotPaneSettings from './components/TransitionMatrixPlotPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { TransitionMatrixPlotSettings } from './types'

export const transitionMatrixDefinition = definePlot<
  'transitionMatrix',
  TransitionMatrixPlotSettings
>({
  type: 'transitionMatrix',
  name: 'Transition Matrix',
  component: TransitionMatrixPlot,
  paneSettings: TransitionMatrixPlotPaneSettings,
  export: { figure: TransitionMatrixExportFigure },
  getSubtitle: ({ item, engine }) => {
    const parts: PlotSubtitleParts = []
    const stim = getStimuliOptions(engine).find(
      o => o.value === String(item.settings.stimulusId)
    )
    if (stim?.label) parts.push({ label: 'Stimulus', value: stim.label })
    const group = getParticipantsGroupOptions(
      engine,
      true,
      item.settings.stimulusId
    ).find(o => o.value === String(item.settings.groupId))
    if (group?.label) parts.push({ label: 'Group', value: group.label })
    return parts.length === 0 ? undefined : parts
  },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    stimuliColorValueRanges: [],
    metricInstanceIds: ['transitionCount-fix'],
    belowMinColor: INACTIVE_COLOR,
    aboveMaxColor: INACTIVE_COLOR,
    showBelowMinLabels: false,
    showAboveMaxLabels: false,
    colorScale: [...PRESET_PALETTES.BLUE.colors],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'aoi-pair-matrix',
    windowing: 'forbidden',
  },
})
