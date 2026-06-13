<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Select } from '$lib/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { METRIC_CORRELATION_VIEWS } from '../../const'
  import type {
    MetricCorrelationItem,
    MetricCorrelationSettings,
  } from '../../types'

  let { item }: { item: MetricCorrelationItem } = $props()
  const bulk = createBulkContext<MetricCorrelationSettings>(() => item)

  const view = $derived(bulk.common(s => s.view))
  const visSummary = $derived(
    view.mixed ? 'Mixed' : view.value === 'heatmap' ? 'Heatmap' : 'Splom'
  )
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  <Select
    options={METRIC_CORRELATION_VIEWS.map(v => ({
      label: v.label,
      value: v.value,
    }))}
    value={view.value}
    mixed={view.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail
      if (v === 'heatmap' || v === 'splom') bulk.update({ view: v })
    }}
  />
</PaneSection>
