import { resolveEventSelectionNames } from '$lib/data/engine'
import { eventGroups } from '$lib/metrics'
import { distributionParticipants, entitySlots } from '$lib/plots/shared/distribution'
import {
  defineDistributionPlot,
  type DistributionPlotSettings,
} from '$lib/plots/shared/distribution/plot'

export type EventComparisonSettings = DistributionPlotSettings<'channel'> & {
  /** Per-plot event SELECTION id; unset/0 = all channels. */
  eventSelectionId?: number
}

/**
 * One distribution per event channel, narrowed by the plot's event SELECTION.
 * Gated on the `event` capability alone: it reads no gaze segments, so an
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
  // The metric IS the per-channel vector, drawn whole; single channels are a
  // `pick-event` projection on scalar plots.
  contract: { outputShape: 'event-vector', windowing: 'forbidden', crossParticipant: 'distribution' },
  categoryOrder: { label: 'Channel order', value: 'channel' },
  selectionSection: 'event',
  defaults: { metricInstanceIds: ['eventDuration'] },
  requireCapabilities: ['event'],
  disclosures: {
    itemTooltipKey: 'Event',
    cannotFitHints: ['Select fewer event channels in Plot Settings > Events'],
    ariaLabel: 'Event channel comparison',
  },
  // Canonical `eventGroups` order, the vectors' index order, so each merge keeps
  // its slot; narrowed by the same name resolution as the scarf overlay.
  axis: (engine, settings) => {
    const axis = eventGroups(engine, settings.stimulusId).map((g, slot) => ({ ...g, slot }))
    const names = resolveEventSelectionNames(engine, settings.eventSelectionId)
    const kept = names ? axis.filter(g => names.has(g.displayedName)) : axis
    return { slots: entitySlots(kept), ...distributionParticipants(engine, settings) }
  },
})
