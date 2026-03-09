<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { getFileState } from '$lib/session'
  import { getContext } from 'svelte'

  const fileState = getFileState()
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
