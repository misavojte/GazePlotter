import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getStimuli,
  getAllParticipants,
  getParticipantsSelections,
} from '$lib/data/engine'

/**
 * Get the stimuli options for a plot
 * @returns {Array} The stimuli options
 */
export function getStimuliOptions(engine: DataEngine) {
  if (!engine.metadata) return []

  return getStimuli(engine).map(s => ({
    label: s.displayedName,
    value: s.id.toString(),
  }))
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
  if (!engine.metadata) return []

  return getParticipantsSelections(engine, includeDefault, stimulusId).map(s => ({
    label: s.name,
    value: s.id.toString(),
  }))
}

/**
 * Get the participant options for a plot
 * @returns {Array} The participant options
 */
export function getParticipantOptions(engine: DataEngine) {
  if (!engine.metadata) return []

  return getAllParticipants(engine).map(p => ({
    label: p.displayedName,
    value: p.id.toString(),
  }))
}

