import { deriveEvolvingMetricsView } from './core/view'
import {
  StimulusSection,
  GroupSection,
  MetricSection,
  TimelineRangeSection,
  AoiSection,
} from '$lib/plots/shared/components/sections'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import { PRESET_PALETTES } from '$lib/color/palettes'
import type { EvolvingMetricsSettings } from './types'

export const evolvingMetricsDefinition = definePlot<
  'evolvingMetrics',
  EvolvingMetricsSettings
>({
  type: 'evolvingMetrics',
  name: 'Metric Timeline',
  group: 'per-participant',
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'group', component: GroupSection },
    { key: 'metric', component: MetricSection },
    {
      key: 'evolvingMetrics:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'presentation',
          options: [
            { label: 'Heatmap', value: 'heatmap' },
            { label: 'Overlay', value: 'overlay' },
          ],
          default: 'heatmap',
          summary: true,
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          defaultMin: PRESET_PALETTES.HEAT.colors[0],
          defaultMax: PRESET_PALETTES.HEAT.colors[2],
          showWhen: ctx => {
            const p = ctx.common(s => s.presentation ?? 'heatmap')
            return !p.mixed && p.value === 'heatmap'
          },
        },
      ],
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  view: {
    deriveView: deriveEvolvingMetricsView,
    viewDependsOnWidth: true,
  },
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['avgFixationDuration-any-windowed'],
    timelineStart: 0,
    timelineEnd: 0,
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'scalar',
    windowing: 'required',
    crossParticipant: 'per-participant',
  },
})
