<script lang="ts">
  import { ButtonMajor } from '$lib/shared/components'
  import { getIngestService } from '$lib/session'
  import { getContext } from 'svelte'

  const ingest = getIngestService()
  const getLabel = getContext<() => string>('reinitializeLabel')

  interface Props {
    onReinitialize: () => void
  }

  const { onReinitialize }: Props = $props()

  let isDisabled = $derived(ingest.isLoading)
</script>

<ButtonMajor {isDisabled} onclick={onReinitialize}>
  {getLabel()}
</ButtonMajor>
