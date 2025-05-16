<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { processingFileStateStore } from '$lib/workspace'
  import { getContext } from 'svelte'

  const label = getContext('reinitializeLabel')

  interface Props {
    onReinitialize: () => void
  }

  const { onReinitialize }: Props = $props()

  let isDisabled = $derived($processingFileStateStore === 'processing')
</script>

<GeneralButtonMajor {isDisabled} onclick={onReinitialize}>
  {label}
</GeneralButtonMajor>
