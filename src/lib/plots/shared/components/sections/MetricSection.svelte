<script lang="ts">
  import MetricPaneSection from '../MetricPaneSection.svelte'
  import { createBulkContext } from './common'
  import type { PaneSectionItem } from '$lib/plots/definePlot'

  // Metric selection is type-specific (a metric instance's contract is tied to
  // the plot type), so this is NOT a cross-type-shared section — it only renders
  // for a single plot or a same-type bulk, where the contract is identical.
  let { item, label }: { item: PaneSectionItem; label?: string } = $props()
  const bulk = createBulkContext<{ metricInstanceIds?: string[] }>(() => item)

  // Divergence computed from the real selection (array deep-equal), so the
  // picker shows "Mixed" when the selected plots pick different metrics.
  const metric = $derived(bulk.common(s => s.metricInstanceIds ?? []))
</script>

<MetricPaneSection
  {item}
  {label}
  metricInstanceIds={metric.value}
  mixed={metric.mixed}
  onchange={ids => bulk.update({ metricInstanceIds: ids })}
/>
