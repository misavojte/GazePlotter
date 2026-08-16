import { resolveEventSelectionNames } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { eventGroups, type PlotMetricContract } from '$lib/metrics'
import {
  collectDistribution,
  distributionParticipants,
  type DistributionAxis,
  type DistributionResult,
} from '$lib/plots/shared/distribution'
import type { EventComparisonSettings } from '../types'

/**
 * Event-vector instances only: the metric IS the per-channel vector, and this
 * plot draws the whole vector as one distribution per channel (identity
 * projection). Single channels are a `pick-event` projection concern on
 * scalar plots, never a parameter.
 */
export const EVENT_COMPARISON_CONTRACT = {
  outputShape: 'event-vector',
  windowing: 'forbidden',
  crossParticipant: 'distribution',
} as const satisfies PlotMetricContract

type EventComparisonDataSettings = Pick<
  EventComparisonSettings,
  | 'stimulusId'
  | 'groupId'
  | 'eventSelectionId'
  | 'metricInstanceIds'
  | 'orderBy'
  | 'orderDirection'
  | 'scaleRange'
  | 'timelineStart'
  | 'timelineEnd'
  | 'statisticalOverlay'
>

/**
 * One distribution per event channel, straight off the library instance's
 * event-vector result (never a parallel computation), through the shared
 * distribution collector: this plot contributes ONLY its contract and its
 * channel axis, exactly as the comparison siblings contribute theirs.
 */
export function getEventComparisonData(
  engine: DataEngine,
  settings: EventComparisonDataSettings
): DistributionResult {
  const meta = engine.metadata
  if (!meta) throw new Error('No metadata found')

  return collectDistribution({
    engine,
    contract: EVENT_COMPARISON_CONTRACT,
    settings,
    axis: () => channelAxis(engine, settings),
  })
}

/**
 * The channel axis: the stimulus's canonical `eventGroups` order (the same
 * contract the recipes' vectors are indexed by, so each MERGE keeps its
 * slot), narrowed by the per-plot event SELECTION through the same
 * displayed-name resolution the scarf overlay uses.
 */
function channelAxis(
  engine: DataEngine,
  settings: EventComparisonDataSettings
): DistributionAxis {
  const axis = eventGroups(engine, settings.stimulusId).map((g, slot) => ({
    ...g,
    slot,
  }))
  const names = resolveEventSelectionNames(engine, settings.eventSelectionId)
  const kept = names ? axis.filter(g => names.has(g.displayedName)) : axis

  return {
    slots: kept.map(channel => ({
      slot: channel.slot,
      label: channel.displayedName,
      color: channel.color,
    })),
    ...distributionParticipants(engine, settings),
  }
}
