import { deriveAoiStreamView } from './core/view'
import { aoiStreamScreen } from './core/screen.svelte'
import {
  StimulusSection,
  GroupSection,
  MetricSection,
  TimelineRangeSection,
  AoiSection,
} from '$lib/plots/shared/components/sections'
import AoiStreamVisualisationSection from './components/sections/AoiStreamVisualisationSection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { AoiStreamPlotSettings } from './types'

export const aoiStreamPlotDefinition = definePlot<
  'aoiStreamPlot',
  AoiStreamPlotSettings
>({
  type: 'aoiStreamPlot',
  name: 'AOI Timeline',
  group: 'per-aoi',
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'group', component: GroupSection },
    { key: 'metric', component: MetricSection },
    {
      key: 'aoiStreamPlot:visualisation',
      component: AoiStreamVisualisationSection,
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  view: {
    deriveView: deriveAoiStreamView,
    viewDependsOnWidth: true,
    viewOnlySettings: ['highlights'],
  },
  screen: aoiStreamScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['absoluteTime-aoi-windowed-500'],
    absoluteStimuliLimits: [],
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
    windowing: 'required',
    crossParticipant: 'reduce',
  },
})
