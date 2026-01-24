import {
  getStimuli,
  getParticipantsGroups,
  getParticipants,
} from '$lib/gaze-data/front-process/stores/dataStore.svelte'

/**
 * Get the stimuli options for a plot
 * @returns {Array} The stimuli options
 */
export function getStimuliOptions() {
  return getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
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
  includeDefault: boolean = true,
  stimulusId: number = 0
) {
  return getParticipantsGroups(includeDefault, stimulusId).map(group => {
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
export function getParticipantOptions() {
  return getParticipants().map(participant => {
    return {
      label: participant.displayedName,
      value: participant.id.toString(),
    }
  })
}
