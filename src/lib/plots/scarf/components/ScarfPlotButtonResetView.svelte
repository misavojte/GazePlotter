<script lang="ts">
  import { GeneralButtonMinor } from '$lib/shared/components'
  import RefreshCcw from 'lucide-svelte/icons/refresh-ccw'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  // Use callback props instead of event dispatching
  let { settings, onWorkspaceCommand }: Props = $props()

  // Check if view is already at default (empty limits or [0, 0])
  let isDisabled = $derived(
    (() => {
      const stimulusId = settings.stimulusId

      if (settings.timeline === 'absolute') {
        const limits = settings.absoluteStimuliLimits[stimulusId]
        return !limits || (limits[0] === 0 && limits[1] === 0)
      } else if (settings.timeline === 'ordinal') {
        const limits = settings.ordinalStimuliLimits[stimulusId]
        return !limits || (limits[0] === 0 && limits[1] === 0)
      }

      // For relative timeline, we can't reset as it's always 0-100%
      return true
    })()
  )

  const handleClick = () => {
    const stimulusId = settings.stimulusId
    let updatedSettings: Partial<ScarfGridType> = {}

    if (settings.timeline === 'absolute') {
      const updatedLimits = { ...settings.absoluteStimuliLimits }
      updatedLimits[stimulusId] = [0, 0]
      updatedSettings = { absoluteStimuliLimits: updatedLimits }
    } else if (settings.timeline === 'ordinal') {
      const updatedLimits = { ...settings.ordinalStimuliLimits }
      updatedLimits[stimulusId] = [0, 0]
      updatedSettings = { ordinalStimuliLimits: updatedLimits }
    }
    // For relative timeline, we can't reset as it's always 0-100%

    // Create workspace command for settings change
    onWorkspaceCommand({
      type: 'updateSettings',
      itemId: settings.id,
      settings: updatedSettings
    })
  }
</script>

<GeneralButtonMinor onclick={handleClick} {isDisabled}>
  <RefreshCcw size={'1em'} strokeWidth={1} />
</GeneralButtonMinor>
