<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio, Select } from '$lib/shared/components'
  import {
    TimelineRangeSection,
    AoiPaneSection,
    StimulusPaneSection,
    ParticipantGroupPaneSection,
    MetricPaneSection,
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

  const visSummary = $derived(
    settings.view === 'heatmap' ? 'Heatmap' : 'Splom'
  )
  const methodSummary = $derived(
    settings.correlationMethod === 'pearson' ? 'Pearson' : 'Spearman'
  )
</script>

<StimulusPaneSection
  stimulusId={settings.stimulusId}
  onchange={id => update({ stimulusId: id })}
  {source}
/>

<ParticipantGroupPaneSection
  groupId={settings.groupId}
  stimulusId={settings.stimulusId}
  onchange={id => update({ groupId: id })}
  {source}
/>

<MetricPaneSection
  {item}
  metricInstanceIds={settings.metricInstanceIds}
  onchange={ids => update({ metricInstanceIds: ids })}
  label="Metrics"
/>

<PaneSection title="Visualisation" summary={visSummary}>
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

<PaneSection title="Correlation method" summary={methodSummary}>
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

<AoiPaneSection stimulusId={settings.stimulusId} {source} />


