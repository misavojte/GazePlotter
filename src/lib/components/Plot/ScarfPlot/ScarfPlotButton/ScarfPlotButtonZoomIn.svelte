<script lang="ts">
  import MinorButton from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'
  import type { ScarfGridType } from '$lib/type/gridType'

  interface Props {
    settings: ScarfGridType
    settingsChange?: (settings: Partial<ScarfGridType>) => void
  }

  // Use callback props instead of event dispatching
  let { settings, settingsChange }: Props = $props()

  let isDisabled = $derived(settings.zoomLevel > 3)

  const handleClick = () => {
    console.log('settings', settings)
    if (!isDisabled) {
      // Call the callback prop with the updated settings
      settingsChange({
        zoomLevel: settings.zoomLevel + 1,
      })
    }
  }
</script>

<MinorButton onclick={handleClick} {isDisabled}>
  <ZoomIn size={'1em'} strokeWidth={1} />
</MinorButton>
