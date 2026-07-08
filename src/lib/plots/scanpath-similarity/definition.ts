import { deriveScanpathSimilarityView } from './core/view'
import { scanpathSimilarityScreen } from './core/screen.svelte'
import {
  StimulusSection,
  GroupSection,
  MetricSection,
  TimelineRangeSection,
  AoiSection,
} from '$lib/plots/shared/components/sections'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { ScanpathSimilaritySettings } from './types'

// View-gated sub-controls hide while `view` diverges across a bulk selection.
const viewIs = (mode: string) => (ctx: SectionFieldCtx) => {
  const v = ctx.common(s => s.view ?? 'matrix')
  return !v.mixed && v.value === mode
}

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
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'view',
          options: [
            { label: 'Matrix', value: 'matrix' },
            { label: 'ScanGraph', value: 'scangraph' },
          ],
          default: 'matrix',
          summary: true,
        },
        {
          kind: 'number',
          key: 'threshold',
          label: 'Similarity threshold (0–1)',
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.5,
          showWhen: viewIs('scangraph'),
        },
        {
          kind: 'stimulusColorRange',
          key: 'stimuliColorValueRanges',
          inputMax: 1,
          step: 0.01,
          showWhen: viewIs('matrix'),
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          defaultMin: PRESET_PALETTES.BLUE.colors[0],
          defaultMax: PRESET_PALETTES.BLUE.colors[2],
          showWhen: viewIs('matrix'),
        },
      ],
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
