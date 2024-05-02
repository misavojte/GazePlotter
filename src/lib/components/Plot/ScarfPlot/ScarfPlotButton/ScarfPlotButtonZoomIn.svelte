<script lang="ts">
  import MinorButton from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'

  import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'
  export let settings: ScarfSettingsType

  $: isDisabled = settings.zoomLevel > 3
  const handleClick = () => {
    if (!isDisabled) {
      settings.zoomLevel = settings.zoomLevel + 1
    }
  }
</script>

<MinorButton on:click={handleClick} {isDisabled}>
  <ZoomIn size={'1em'} strokeWidth={1} />
</MinorButton>
