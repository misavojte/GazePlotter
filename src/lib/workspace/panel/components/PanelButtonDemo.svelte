<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { fileState } from '$lib/file.state.svelte'
  import { getContext } from 'svelte'

  const label = getContext('reinitializeLabel')

  interface Props {
    onReinitialize: () => void
  }

  const { onReinitialize }: Props = $props()

  let isDisabled = $derived(fileState.processing === 'processing')
</script>

<GeneralButtonMajor {isDisabled} onclick={onReinitialize}>
  {label}
</GeneralButtonMajor>
