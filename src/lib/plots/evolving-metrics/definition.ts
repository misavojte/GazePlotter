import { deriveEvolvingMetricsView } from './core/view'
import { evolvingMetricsScreen } from './core/screen.svelte'
import { commonIs, definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import { PRESET_PALETTES } from '$lib/color/palettes'
import type { EvolvingMetricsSettings } from './types'

export const evolvingMetricsDefinition = definePlot<
  'evolvingMetrics',
  EvolvingMetricsSettings
>({
  type: 'evolvingMetrics',
  name: 'Metric Timeline',
  tagline: 'A metric over moving time windows',
  group: 'per-participant',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    {
      key: 'evolvingMetrics:visualization',
      title: 'Visualization',
      fields: [
        {
          kind: 'enum',
          key: 'presentation',
          options: [
            { label: 'Heatmap', value: 'heatmap', detail: 'Rows of participants, colored by value' },
            { label: 'Overlay', value: 'overlay', detail: 'One line per participant over time' },
          ],
          default: 'heatmap',
          summary: true,
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          defaultMin: PRESET_PALETTES.HEAT.colors[0],
          defaultMax: PRESET_PALETTES.HEAT.colors[2],
          showWhen: commonIs(s => s.presentation ?? 'heatmap', 'heatmap'),
        },
      ],
    },
    'timelineRange',
    'aoi',
  ],
  view: {
    deriveView: deriveEvolvingMetricsView,
    viewDependsOnWidth: true,
  },
  screen: evolvingMetricsScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['avgFixationDuration-any-windowed'],
    timelineStart: 0,
    timelineEnd: 0,
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'scalar',
    windowing: 'required',
    crossParticipant: 'per-participant',
  },
})
