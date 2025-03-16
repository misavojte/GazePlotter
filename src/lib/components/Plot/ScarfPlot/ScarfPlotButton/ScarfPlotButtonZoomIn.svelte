<script lang="ts">
  import MinorButton from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'
  import ZoomIn from 'lucide-svelte/icons/zoom-in'

  import type { ScarfGridType } from '$lib/type/gridType'
  interface Props {
    settings: ScarfGridType;
  }

  let { settings = $bindable() }: Props = $props();

  let isDisabled = $derived(settings.zoomLevel > 3)
  const handleClick = () => {
    if (!isDisabled) {
      settings.zoomLevel = settings.zoomLevel + 1
    }
  }
</script>

<MinorButton on:click={handleClick} {isDisabled}>
  <ZoomIn size={'1em'} strokeWidth={1} />
</MinorButton>
