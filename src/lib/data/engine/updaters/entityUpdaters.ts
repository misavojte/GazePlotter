import {
  type BaseInterpretedDataType,
  type ParticipantsGroup,
} from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'

/**
 * Updates multiple participant records and their display order.
 */
export const updateMultipleParticipants = (
  engine: DataEngine,
  participants: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates = participants
    .filter(p => p.id >= 0 && p.id < meta.participants.data.length)
    .map(p => ({ id: p.id, data: [p.originalName, p.displayedName] }))
  const newOrder = participants.map(p => p.id)

  engine.updateParticipantsBatch(updates, newOrder)
}

/**
 * Updates the list of participant groups.
 */
export const updateParticipantsGroups = (
  engine: DataEngine,
  groups: ParticipantsGroup[]
) => {
  if (!engine.metadata) return
  engine.setParticipantsGroups(groups)
}

/**
 * Updates multiple stimulus records and their display order.
 */
export const updateMultipleStimuli = (
  engine: DataEngine,
  stimuli: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates = stimuli
    .filter(s => s.id >= 0 && s.id < meta.stimuli.data.length)
    .map(s => ({ id: s.id, data: [s.originalName, s.displayedName] }))
  const newOrder = stimuli.map(s => s.id)

  engine.updateStimuliBatch(updates, newOrder)
}
