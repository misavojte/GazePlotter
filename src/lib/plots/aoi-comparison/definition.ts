import { deriveAoiComparisonView } from './core/view'
import { aoiComparisonScreen } from './core/screen.svelte'
import { definePlot } from '$lib/plots/definePlot'
import {
  pickedInstanceIsProportion as isProportion,
  stimulusGroupSubtitle,
} from '$lib/plots/shared'
import {
  DIRECTION_OPTIONS,
  ORIENTATION_OPTIONS,
  OVERLAY_OPTIONS,
  overlaySummaryLabel,
} from '$lib/plots/shared/distribution'
import type { AoiComparisonSettings } from './types'

export const aoiComparisonDefinition = definePlot<
  'aoiComparison',
  AoiComparisonSettings
>({
  type: 'aoiComparison',
  name: 'AOI Comparison',
  group: 'per-aoi',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    {
      key: 'aoiComparison:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'statisticalOverlay',
          label: 'Statistical overlay',
          options: OVERLAY_OPTIONS,
          showWhen: ctx => !isProportion(ctx),
        },
        {
          kind: 'enum',
          key: 'orientation',
          label: 'Orientation',
          options: ORIENTATION_OPTIONS,
        },
        {
          kind: 'enum',
          key: 'orderBy',
          label: 'Order by',
          options: [
            { label: 'Value', value: 'value' },
            { label: 'AOI order', value: 'aoi' },
          ],
        },
        {
          kind: 'enum',
          key: 'orderDirection',
          label: 'Direction',
          options: DIRECTION_OPTIONS,
        },
        { kind: 'scaleRange', key: 'scaleRange', legend: 'Scale range' },
      ],
      summary: ctx => {
        const orientation = ctx.common(s => s.orientation)
        const overlay = ctx.common(s => s.statisticalOverlay)
        const o = orientation.mixed
          ? 'Mixed'
          : orientation.value === 'horizontal'
            ? 'Horizontal'
            : 'Vertical'
        if (isProportion(ctx)) return `${o} (Bars)`
        if (orientation.mixed || overlay.mixed) return 'Mixed'
        return `${o} (${overlaySummaryLabel(String(overlay.value))})`
      },
    },
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveAoiComparisonView },
  screen: aoiComparisonScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    orientation: 'horizontal',
    orderBy: 'aoi',
    orderDirection: 'asc',
    metricInstanceIds: ['absoluteTime'],
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
    timelineStart: 0,
    timelineEnd: 0,
    hideNoAoi: false,
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'aoi-vector',
    windowing: 'forbidden',
    crossParticipant: 'distribution',
  },
})
