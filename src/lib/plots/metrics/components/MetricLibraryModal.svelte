<script lang="ts">
  // Re-export shim — use $lib/metrics for new code
  import MetricLibraryModalImpl from '$lib/metrics/components/MetricLibraryModal.svelte'
  import type { WindowingConfig } from '$lib/data/types'

  interface Props {
    context: 'global' | 'windowed'
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      windowing?: WindowingConfig,
      replacingId?: number,
    ) => void
    ondeleteInstance?: (id: number) => void
    onrenameInstance?: (id: number, label: string) => void
  }

  let props: Props = $props()
</script>

<MetricLibraryModalImpl {...props} />
