import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import {
  getStimuliOrderVector,
  getParticipantOrderVector,
} from '$lib/data/engine'
import type { GroupSelectItem } from '$lib/shared/components'

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
 * Get the participant group options for a plot
 * @param {boolean} includeDefault - Whether to include default groups
 * @param {number} stimulusId - The stimulus ID for context-sensitive groups
 * @returns {Array} The participant group options
 */
export function getParticipantsGroupOptions(
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

  const groups: Array<{ id: number; name: string; participantsIds: number[] }> =
    []

  if (includeDefault) {
    groups.push({
      id: -1,
      name: 'All participants',
      participantsIds: participantOrder,
    })
    groups.push({
      id: -2,
      name: 'Non-empty',
      participantsIds: participantOrder.filter(
        participantId => reader.getSegmentCount(stimulusId, participantId) > 0
      ),
    })
  }

  for (let i = 0; i < meta.participantsGroups.length; i++) {
    groups.push(meta.participantsGroups[i])
  }

  return groups.map(group => {
    return {
      label: group.name,
      value: group.id.toString(),
    }
  })
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

/**
 * Creates standard Stimulus + Group select items for plot headers.
 */
export function createStimulusGroupSelects(
  engine: DataEngine,
  stimulusId: number,
  groupId: number,
  onStimulusChange: (stimulusId: number) => void,
  onGroupChange: (groupId: number) => void
): GroupSelectItem[] {
  return [
    {
      label: 'Stimulus',
      options: getStimuliOptions(engine),
      value: stimulusId.toString(),
      onchange: (e: CustomEvent) => onStimulusChange(parseInt(e.detail)),
    },
    {
      label: 'Group',
      options: getParticipantsGroupOptions(engine, true, stimulusId),
      value: groupId.toString(),
      onchange: (e: CustomEvent) => onGroupChange(parseInt(e.detail)),
    },
  ]
}
