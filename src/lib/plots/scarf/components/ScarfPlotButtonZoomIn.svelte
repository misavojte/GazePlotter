<script lang="ts">
  import { GeneralButtonMinor } from '$lib/shared/components'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import {
    getNumberOfSegments,
    getParticipantEndTime,
    getParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Use callback props instead of event dispatching
  let { settings, onWorkspaceCommand }: Props = $props()

  // Zoom percentage (how much to zoom in by)
  const ZOOM_PERCENTAGE = 15

  // No need for isDisabled - we can always zoom in further by shrinking the range
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

      // Calculate new range (shrink by ZOOM_PERCENTAGE from both sides)
      const range = currentMax - currentMin
      const changeAmount = (range * ZOOM_PERCENTAGE) / 100

      // Ensure we don't shrink too much (at least 10% of the original range)
      if (range - changeAmount * 2 < range * 0.1) return

      const newMin = Math.max(0, currentMin + changeAmount)
      const newMax = currentMax - changeAmount

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

      // Calculate new range (shrink by ZOOM_PERCENTAGE from both sides)
      const range = currentMax - currentMin
      const changeAmount = Math.ceil((range * ZOOM_PERCENTAGE) / 100)

      // Ensure we don't shrink too much (at least 2 segments visible)
      if (range - changeAmount * 2 < 2) return

      const newMin = Math.max(0, currentMin + changeAmount)
      const newMax = currentMax - changeAmount

      // Create updated settings object
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[stimulusId] = [newMin, newMax]
      updatedSettings = { ordinalStimuliLimits: updatedLimits }
    }
    // For relative timeline, we can't zoom as it's always 0-100%

    // Create workspace command for settings change
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: updatedSettings
    })
  }
</script>

<GeneralButtonMinor onclick={handleClick} {isDisabled}>
  <ZoomIn size={'1em'} strokeWidth={1} />
</GeneralButtonMinor>
