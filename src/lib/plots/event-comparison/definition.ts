import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import { distributionVisualisationSection } from '$lib/plots/shared/distribution/paneSection'
import { EVENT_COMPARISON_CONTRACT } from './core/transformer'
import { deriveEventComparisonView } from './core/view'
import type { EventComparisonSettings } from './types'

/**
 * Per-channel comparison of event metrics (task markers, dynamic-AOI
 * visibility, whatever the event files carry), rendered through the shared
 * distribution layer. The Metric section is the SAME library flow every
 * metric plot uses; the contract admits event-vector instances at identity,
 * and the plot draws the instance's whole vector — one distribution per
 * channel on the stimulus's canonical `eventGroups` axis, narrowed by the
 * per-plot event SELECTION. Single channels are a `pick-event` projection
 * concern on scalar plots, never anything this plot configures.
 *
 * Gated on the `event` capability ALONE: without event data the plot has no
 * axis, and gaze segments are not consumed anywhere in it — the event scan
 * reads occurrence buffers only — so an event-only dataset gets this plot as
 * its native (and default) visualization.
 *
 * No `screen` recipe: this plot does not sync its value axis across siblings
 * today, matching the Eye-movement Comparison.
 */
export const eventComparisonDefinition = definePlot<
  'eventComparison',
  EventComparisonSettings
>({
  type: 'eventComparison',
  name: 'Event Comparison',
  group: 'per-event',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    distributionVisualisationSection({
      key: 'eventComparison:visualisation',
      categoryOrder: { label: 'Channel order', value: 'channel' },
    }),
    'timelineRange',
    'event',
  ],
  view: { deriveView: deriveEventComparisonView },
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['eventDuration'],
    orientation: 'horizontal',
    orderBy: 'channel',
    orderDirection: 'asc',
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
    timelineStart: 0,
    timelineEnd: 0,
  }),
  requireCapabilities: ['event'],
  consumesMetrics: EVENT_COMPARISON_CONTRACT,
})
