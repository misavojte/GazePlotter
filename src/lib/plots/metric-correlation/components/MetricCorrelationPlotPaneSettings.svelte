<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio, Select } from '$lib/shared/components'
  import {
    CommonPlotPaneFields,
    TimelineRangeSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    METRIC_CORRELATION_METHODS,
    METRIC_CORRELATION_VIEWS,
  } from '../const'
  import type {
    MetricCorrelationItem,
    MetricCorrelationSettings,
  } from '../types'
  import { metricCorrelationDefinition } from '../definition'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<MetricCorrelationSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }
</script>

<CommonPlotPaneFields
  {item}
  contract={metricCorrelationDefinition.consumesMetrics!}
  metricLabel="Metrics"
/>

<PaneSection title="Visualisation">
  <Select
    options={METRIC_CORRELATION_VIEWS.map(v => ({
      label: v.label,
      value: v.value,
    }))}
    value={settings.view}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail
      if (v === 'heatmap' || v === 'splom') update({ view: v })
    }}
  />
</PaneSection>

<PaneSection title="Correlation method">
  <Radio
    ariaLabel="Correlation method"
    options={METRIC_CORRELATION_METHODS.map(m => ({
      label: m.label,
      value: m.value,
    }))}
    appearance="compact"
    direction="row"
    value={settings.correlationMethod}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail
      if (v === 'pearson' || v === 'spearman')
        update({ correlationMethod: v })
    }}
  />
</PaneSection>

<TimelineRangeSection {item} />
