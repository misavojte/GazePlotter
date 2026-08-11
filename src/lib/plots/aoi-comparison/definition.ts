import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import { distributionVisualisationSection } from '$lib/plots/shared/distribution/paneSection'
import { distributionValueAxisScreen } from '$lib/plots/shared/distribution/screen.svelte'
import { AOI_COMPARISON_CONTRACT } from './core/transformer'
import { deriveAoiComparisonView } from './core/view'
import type { AoiComparisonSettings } from './types'

/**
 * Per-AOI comparison of a metric, rendered through the shared distribution
 * layer: the Metric section is the SAME library flow every metric plot uses,
 * the contract admits aoi-vector instances at identity, and the plot draws the
 * instance's whole vector — one distribution per AOI of the plot's AOI
 * SELECTION, plus the No-AOI slot.
 */
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
    distributionVisualisationSection({
      key: 'aoiComparison:visualisation',
      categoryOrder: { label: 'AOI order', value: 'aoi' },
    }),
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveAoiComparisonView },
  screen: distributionValueAxisScreen(),
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
  consumesMetrics: AOI_COMPARISON_CONTRACT,
})
