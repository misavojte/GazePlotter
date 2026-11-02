import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  getStimuli,
  getAllParticipants,
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

