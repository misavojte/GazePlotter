<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
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

<GeneralButtonMajor {isDisabled} onclick={onReinitialize}>
  {getLabel()}
</GeneralButtonMajor>
