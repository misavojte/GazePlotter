import { getParticipant, getParticipantsIds } from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ParticipantScope } from '$lib/data/types'
import type { DistributionAxis, DistributionSlot } from './types'

/**
 * The participant dimension every comparison axis shares: one Scope and one
 * display name per participant of the plot's selection, bounded by its time
 * range. A plot's axis builder contributes only its slots and spreads this
 * in. `aoiSelectionId` rides along where the plot has one, so scopes compute
 * against its reduced AOI alphabet; elsewhere it is undefined, meaning all.
 */
export function distributionParticipants(
  engine: DataEngine,
  settings: ParticipantScope & {
    stimulusId: number
    timelineStart?: number
    timelineEnd?: number
    aoiSelectionId?: number
  }
): Pick<DistributionAxis, 'scopes' | 'participantNames'> {
  const participantIds = getParticipantsIds(engine, settings, settings.stimulusId)
  const timeStart = settings.timelineStart ?? 0
  const timeEnd = settings.timelineEnd ?? 0
  return {
    scopes: participantIds.map(participantId => ({
      engine,
      stimulusId: settings.stimulusId,
      participantId,
      timeStart,
      timeEnd,
      aoiSelectionId: settings.aoiSelectionId,
    })),
    participantNames: participantIds.map(
      id => getParticipant(engine, id).displayedName
    ),
  }
}

/** One slot per entity, labelled with its displayed name and highlighted by its id. */
export const entitySlots = (
  entities: readonly { slot: number; id: number; displayedName: string; color: string }[]
): DistributionSlot[] =>
  entities.map(e => ({ slot: e.slot, id: String(e.id), label: e.displayedName, color: e.color }))
