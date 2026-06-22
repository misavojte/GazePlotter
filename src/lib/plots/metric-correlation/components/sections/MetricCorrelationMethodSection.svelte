<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio } from '$lib/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { METRIC_CORRELATION_METHODS } from '../../const'
  import type {
    MetricCorrelationItem,
    MetricCorrelationSettings,
  } from '../../types'

  let { item }: { item: MetricCorrelationItem } = $props()
  const bulk = createBulkContext<MetricCorrelationSettings>(() => item)

  const method = $derived(bulk.common(s => s.correlationMethod))
  const methodSummary = $derived(
    method.mixed
      ? 'Mixed'
      : method.value === 'pearson'
        ? 'Pearson'
        : 'Spearman'
  )
</script>

<PaneSection title="Correlation method" summary={methodSummary}>
  <Radio
    ariaLabel="Correlation method"
    options={METRIC_CORRELATION_METHODS.map(m => ({
      label: m.label,
      value: m.value,
    }))}
    appearance="compact"
    direction="row"
    value={method.value}
    mixed={method.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail
      if (v === 'pearson' || v === 'spearman')
        bulk.update({ correlationMethod: v })
    }}
  />
</PaneSection>
