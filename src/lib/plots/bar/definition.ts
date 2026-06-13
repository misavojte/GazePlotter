import BarPlot from './components/BarPlot.svelte'
import { deriveBarView } from './core/view'
import {
  StimulusSection,
  GroupSection,
  MetricSection,
  TimelineRangeSection,
  AoiSection,
} from '$lib/plots/shared/components/sections'
import BarVisualisationSection from './components/sections/BarVisualisationSection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { BarPlotSettings } from './types'

export const barPlotDefinition = definePlot<'barPlot', BarPlotSettings>({
  type: 'barPlot',
  name: 'AOI Metrics',
  component: BarPlot,
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'group', component: GroupSection },
    { key: 'metric', component: MetricSection },
    { key: 'barPlot:visualisation', component: BarVisualisationSection },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  export: { deriveView: deriveBarView },
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
    barPlottingType: 'horizontal',
    orderBy: 'aoi',
    orderDirection: 'asc',
    metricInstanceIds: ['absoluteTime'],
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
    timelineStart: 0,
    timelineEnd: 0,
    hideNoAoi: false,
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'aoi-vector',
    windowing: 'forbidden',
  },
})
