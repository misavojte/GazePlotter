<script lang="ts">
  import { GeneralButtonMinor } from '$lib/shared/components'
  import ZoomOut from 'lucide-svelte/icons/zoom-out'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

  // Zoom percentage (how much to zoom out by)
  const ZOOM_PERCENTAGE = 15

  // We can always zoom out (there's no real limit to zooming out)
  let isDisabled = $derived(settings.timeline === 'relative')

  // Function to calculate the actual max value for a stimulus when limits are [0, 0]
  function calculateActualMax(stimulusId: number): number {
    const participants = getParticipants(settings.groupId, stimulusId)
    const participantIds = participants.map(p => p.id)

    if (settings.timeline === 'absolute') {
      // For absolute timeline, max is the longest participant timeline
      return participantIds.reduce(
        (max, participantId) =>
          Math.max(max, getParticipantEndTime(stimulusId, participantId)),
        0
      )
    } else if (settings.timeline === 'ordinal') {
      // For ordinal timeline, max is the largest segment count
      return participantIds.reduce(
        (max, participantId) =>
          Math.max(max, getNumberOfSegments(stimulusId, participantId)),
        0
      )
    }

    return 100 // Default for relative timeline
  }

  const handleClick = () => {
    const stimulusId = settings.stimulusId

    // Calculate the current range based on timeline type
    let currentMin: number
    let currentMax: number
    let updatedSettings: Partial<ScarfGridType> = {}

    if (settings.timeline === 'absolute') {
      const limits = settings.absoluteStimuliLimits[stimulusId] || [0, 0]
      currentMin = limits[0]

      // If currentMax is 0, it means auto-calculate from data
      if (limits[1] === 0) {
        currentMax = calculateActualMax(stimulusId)
      } else {
        currentMax = limits[1]
      }

      // Calculate new range (expand by ZOOM_PERCENTAGE from both sides)
      const range = currentMax - currentMin
      const changeAmount = (range * ZOOM_PERCENTAGE) / 100

      // Never go below zero on the left
      const newMin = Math.max(0, currentMin - changeAmount)
      const newMax = currentMax + changeAmount

      // Create updated settings object
      const updatedLimits = { ...settings.absoluteStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updatedSettings = { absoluteStimuliLimits: updatedLimits }
    } else if (settings.timeline === 'ordinal') {
      const limits = settings.ordinalStimuliLimits[stimulusId] || [0, 0]
      currentMin = limits[0]

      // If currentMax is 0, it means auto-calculate from data
      if (limits[1] === 0) {
        currentMax = calculateActualMax(stimulusId)
      } else {
        currentMax = limits[1]
      }

      // Calculate new range (expand by ZOOM_PERCENTAGE from both sides)
      const range = currentMax - currentMin
      const changeAmount = Math.ceil((range * ZOOM_PERCENTAGE) / 100)

      // Never go below zero on the left
      const newMin = Math.max(0, currentMin - changeAmount)
      const newMax = currentMax + changeAmount

      // Create updated settings object
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updatedSettings = { ordinalStimuliLimits: updatedLimits }
    }
    // For relative timeline, we can't zoom as it's always 0-100%

    // Call the settings change handler with the updated settings
    settingsChange(updatedSettings)
  }
</script>

<GeneralButtonMinor onclick={handleClick} {isDisabled}>
  <ZoomOut size={'1em'} strokeWidth={1} />
</GeneralButtonMinor>
