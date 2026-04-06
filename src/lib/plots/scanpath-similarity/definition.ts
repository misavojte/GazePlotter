import ScanpathSimilarityPlot from './components/ScanpathSimilarityPlot.svelte'
import ScanpathSimilarityExportFigure from './components/ScanpathSimilarityExportFigure.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import type { ScanpathSimilaritySettings } from './types'

export const scanpathSimilarityDefinition = definePlot<
  'scanpathSimilarity',
  ScanpathSimilaritySettings
>({
  type: 'scanpathSimilarity',
  name: 'Scanpath Similarity',
  component: ScanpathSimilarityPlot,
  export: { figure: ScanpathSimilarityExportFigure },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    similarityMethod: 'levenshtein',
    view: 'matrix',
    threshold: 0.5,
    collapsed: false,
    colorScale: [...PRESET_PALETTES.BLUE.colors],
    stimuliColorValueRanges: [],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
})
