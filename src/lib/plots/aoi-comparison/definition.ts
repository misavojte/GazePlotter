import { definePlot } from '$lib/plots/definePlot'
import { stimulusParticipantsSubtitle } from '$lib/plots/shared'
import { distributionDefaults, distributionVisualizationSection } from '$lib/plots/shared/distribution/paneSection'
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
  tagline: 'A metric per AOI across participants',
  group: 'per-aoi',
  paneSections: [
    'stimulus',
    'participants',
    'metric',
    distributionVisualizationSection({
      key: 'aoiComparison:visualization',
      categoryOrder: { label: 'AOI order', value: 'aoi' },
    }),
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveAoiComparisonView },
  screen: distributionValueAxisScreen(),
  getSubtitle: stimulusParticipantsSubtitle,
  getDefaultSettings: (params = {}) => ({
    ...distributionDefaults(params),
    orderBy: 'aoi',
    metricInstanceIds: ['absoluteTime'],
    hideNoAoi: false,
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: AOI_COMPARISON_CONTRACT,
})
