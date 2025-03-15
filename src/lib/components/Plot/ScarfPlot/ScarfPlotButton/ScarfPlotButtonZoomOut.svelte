<script lang="ts">
  import MinorButton from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import ZoomOut from 'lucide-svelte/icons/zoom-out'
  import type { ScarfGridType } from '$lib/type/gridType'
  export let settings: ScarfGridType

  $: isDisabled = settings.zoomLevel <= 0
  const handleClick = () => {
    if (!isDisabled) {
      settings.zoomLevel = settings.zoomLevel - 1
    }
  }
</script>

<MinorButton on:click={handleClick} {isDisabled}>
  <ZoomOut size={'1em'} strokeWidth={1} />
</MinorButton>
