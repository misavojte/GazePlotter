<script lang="ts">
  // Re-export shim — use $lib/metrics for new code
  import MetricSelectImpl from '$lib/metrics/components/MetricSelect.svelte'
  import type { MetricInstance } from '$lib/metrics'
  import type { WindowingConfig } from '$lib/data/types'

  interface Props {
    instances: readonly MetricInstance[]
    selectedIds: number[]
    onchange: (ids: number[]) => void
    onrenameInstance?: (id: number, label: string) => void
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      windowing?: WindowingConfig,
      replacingId?: number,
    ) => void
    ondeleteInstance?: (id: number) => void
    context?: 'global' | 'windowed'
    label?: string
  }

  let props: Props = $props()
</script>

<MetricSelectImpl {...props} />
