import ScanpathSimilarityPlot from './components/ScanpathSimilarityPlot.svelte'
import ScanpathSimilarityExportFigure from './components/ScanpathSimilarityExportFigure.svelte'
import ScanpathSimilarityPaneSettings from './components/ScanpathSimilarityPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { ScanpathSimilaritySettings } from './types'

export const scanpathSimilarityDefinition = definePlot<
  'scanpathSimilarity',
  ScanpathSimilaritySettings
>({
  type: 'scanpathSimilarity',
  name: 'Scanpath Similarity',
  component: ScanpathSimilarityPlot,
  paneSettings: ScanpathSimilarityPaneSettings,
  export: { figure: ScanpathSimilarityExportFigure },
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
    metricInstanceId: 'participantPairSimilarity-lev',
    view: 'matrix',
    threshold: 0.5,
    colorScale: [...PRESET_PALETTES.BLUE.colors],
    stimuliColorValueRanges: [],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'participant-pair-matrix',
    windowing: 'forbidden',
  },
})
