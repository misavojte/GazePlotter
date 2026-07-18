import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getStimuliOrderVector,
  getParticipantOrderVector,
} from '$lib/data/engine'
import { ALL_SELECTION_LABEL } from '$lib/data/types'

/**
 * Get the stimuli options for a plot
 * @returns {Array} The stimuli options
 */
export function getStimuliOptions(engine: DataEngine) {
  const meta = engine.metadata
  if (!meta) return []

  const order = getStimuliOrderVector(engine)

  return order.map(id => {
    const stimulus = meta.stimuli.data[id]
    return {
      label: stimulus?.[1] ?? stimulus?.[0] ?? '',
      value: id.toString(),
    }
  })
}

/**
 * Get the participant selection options for a plot
 * @param {boolean} includeDefault - Whether to include the default selections
 * @param {number} stimulusId - The stimulus ID for context-sensitive selections
 * @returns {Array} The participant selection options
 */
export function getParticipantsSelectionOptions(
  engine: DataEngine,
  includeDefault: boolean = true,
  stimulusId: number = 0
) {
  const meta = engine.metadata
  const reader = engine.getReader()
  if (!meta || !reader) return []

  const participantOrder =
    meta.participants.orderVector.length === 0
      ? Array.from({ length: meta.participants.data.length }, (_, i) => i)
      : meta.participants.orderVector

  const defaultSelections = includeDefault
    ? [
        {
          id: -1,
          name: ALL_SELECTION_LABEL,
          participantsIds: participantOrder,
        },
        {
          id: -2,
          name: 'Non-empty',
          participantsIds: participantOrder.filter(
            participantId => reader.getSegmentCount(stimulusId, participantId) > 0
          ),
        },
      ]
    : []

  const selections = [...defaultSelections, ...meta.participantsSelections]

  return selections.map(selection => ({
    label: selection.name,
    value: selection.id.toString(),
  }))
}

/**
 * Get the participant options for a plot
 * @returns {Array} The participant options
 */
export function getParticipantOptions(engine: DataEngine) {
  const meta = engine.metadata
  if (!meta) return []

  const order = getParticipantOrderVector(engine)

  return order.map(id => {
    const participant = meta.participants.data[id]
    return {
      label: participant?.[1] ?? participant?.[0] ?? '',
      value: id.toString(),
    }
  })
}

