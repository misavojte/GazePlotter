<script lang="ts">
  import { MetricSection } from '$lib/plots/shared/components/sections'
  import type { MetricCorrelationItem } from '../../types'

  let { item }: { item: MetricCorrelationItem } = $props()
</script>

<MetricSection {item} label="Metrics" />
