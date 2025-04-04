<script lang="ts">
  import MinorButton from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import type { ScarfGridType } from '$lib/type/gridType'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange = () => {} }: Props = $props()

  // Zoom percentage (how much to zoom in by)
  const ZOOM_PERCENTAGE = 15

  // No need for isDisabled - we can always zoom in further by shrinking the range
  let isDisabled = $derived(false)

  const handleClick = () => {
    const stimulusId = settings.stimulusId

    // Calculate the current range based on timeline type
    let currentMin: number
    let currentMax: number
    let updatedSettings: Partial<ScarfGridType> = {}

    if (settings.timeline === 'absolute') {
      const limits = settings.absoluteStimuliLimits[stimulusId] || [0, 0]
      currentMin = limits[0]
      currentMax = limits[1]

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
      currentMax = limits[1]

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

    // Call the settings change handler with the updated settings
    settingsChange(updatedSettings)
  }
</script>

<MinorButton onclick={handleClick} {isDisabled}>
  <ZoomIn size={'1em'} strokeWidth={1} />
</MinorButton>
