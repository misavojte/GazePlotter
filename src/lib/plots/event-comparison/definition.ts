import { resolveEventSelectionNames } from '$lib/data/engine'
import { eventGroups, type PlotMetricContract } from '$lib/metrics'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'

/**
 * Event-vector instances only: the metric IS the per-channel vector, and this
 * plot draws the whole vector as one distribution per channel (identity
 * projection). Single channels are a `pick-event` projection concern on scalar
 * plots, never a parameter.
 */
export const EVENT_COMPARISON_CONTRACT = {
  outputShape: 'event-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

export type EventComparisonSettings = DistributionPlotSettings<'channel'> & {
  /** Per-plot event SELECTION id; unset/0 = all channels. */
  eventSelectionId?: number
}

/**
 * Per-channel comparison of event metrics (task markers, dynamic-AOI
 * visibility, whatever the event files carry): one distribution per channel on
 * the stimulus's canonical `eventGroups` axis, narrowed by the plot's event
 * SELECTION.
 *
 * Gated on the `event` capability ALONE: gaze segments are not consumed
 * anywhere in it (the event scan reads occurrence buffers only), so an
 * event-only dataset gets this plot as its native visualization.
 */
export const eventComparisonDefinition = defineDistributionPlot<
  'eventComparison',
  EventComparisonSettings
>({
  type: 'eventComparison',
  name: 'Event Comparison',
  tagline: 'A metric per event channel',
  group: 'per-event',
  contract: EVENT_COMPARISON_CONTRACT,
  categoryOrder: { label: 'Channel order', value: 'channel' },
  selectionSection: 'event',
  defaults: { metricInstanceIds: ['eventDuration'] },
  requireCapabilities: ['event'],
  disclosures: {
    itemTooltipKey: 'Event',
    cannotFitHints: ['Select fewer event channels in Plot Settings > Events'],
    ariaLabel: 'Event channel comparison',
  },
  // The stimulus's canonical `eventGroups` order (the order the recipes'
  // vectors are indexed by, so each MERGE keeps its slot), narrowed by the
  // same displayed-name resolution the scarf overlay uses.
  axis: (engine, settings) => {
    const axis = eventGroups(engine, settings.stimulusId).map((g, slot) => ({ ...g, slot }))
    const names = resolveEventSelectionNames(engine, settings.eventSelectionId)
    const kept = names ? axis.filter(g => names.has(g.displayedName)) : axis
    return { slots: entitySlots(kept), ...distributionParticipants(engine, settings) }
  },
})
