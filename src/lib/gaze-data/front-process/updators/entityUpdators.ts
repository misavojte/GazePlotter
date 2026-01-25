import {
  type BaseInterpretedDataType,
  type ParticipantsGroup,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'

/**
 * Updates multiple participant records and their display order.
 */
export const updateMultipleParticipants = (
  participants: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates: { id: number; data: string[] }[] = []
  const newOrder = [...participants.map(p => p.id)]

  participants.forEach(p => {
    if (p.id >= 0 && p.id < meta.participants.data.length) {
      updates.push({ id: p.id, data: [p.originalName, p.displayedName] })
    }
  })

  engine.updateParticipantsBatch(updates, newOrder)
}

/**
 * Updates the list of participant groups.
 */
export const updateParticipantsGroups = (groups: ParticipantsGroup[]) => {
  if (!engine.metadata) return
  engine.setParticipantsGroups(groups)
}

/**
 * Updates multiple stimulus records and their display order.
 */
export const updateMultipleStimuli = (
  stimuli: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates: { id: number; data: string[] }[] = []
  const newOrder = [...stimuli.map(p => p.id)]

  stimuli.forEach(s => {
    if (s.id >= 0 && s.id < meta.stimuli.data.length) {
      updates.push({ id: s.id, data: [s.originalName, s.displayedName] })
    }
  })

  engine.updateStimuliBatch(updates, newOrder)
}
