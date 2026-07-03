import { deriveScanpathSimilarityView } from './core/view'
import { scanpathSimilarityScreen } from './core/screen.svelte'
import {
  StimulusSection,
  GroupSection,
  MetricSection,
  TimelineRangeSection,
  AoiSection,
} from '$lib/plots/shared/components/sections'
import ScanpathSimilarityVisualisationSection from './components/sections/ScanpathSimilarityVisualisationSection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { ScanpathSimilaritySettings } from './types'

export const scanpathSimilarityDefinition = definePlot<
  'scanpathSimilarity',
  ScanpathSimilaritySettings
>({
  type: 'scanpathSimilarity',
  name: 'Scanpath Similarity',
  group: 'inter-participant',
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'group', component: GroupSection },
    { key: 'metric', component: MetricSection },
    {
      key: 'scanpathSimilarity:visualisation',
      component: ScanpathSimilarityVisualisationSection,
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  view: { deriveView: deriveScanpathSimilarityView },
  screen: scanpathSimilarityScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['participantPairSimilarity-lev'],
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
    crossParticipant: 'group-axis',
  },
})
