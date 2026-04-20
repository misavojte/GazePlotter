<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
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
  import { MetricSelect } from '$lib/metrics'
  import { metricCorrelationDefinition } from '../definition'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<MetricCorrelationSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )
</script>

<PaneSection title="Filters">
  <Select
    label="Stimulus"
    options={stimulusOptions}
    value={String(settings.stimulusId)}
    onchange={e => update({ stimulusId: Number((e as CustomEvent).detail) })}
  />
  <Select
    label="Participant group"
    options={groupOptions}
    value={String(settings.groupId)}
    onchange={e => update({ groupId: Number((e as CustomEvent).detail) })}
  />
</PaneSection>

<PaneSection title="View">
  <MetricSelect
    label="Metrics"
    context={metricCorrelationDefinition.consumesMetrics!}
    instances={engine.metadata?.metricInstances ?? []}
    selectedIds={settings.enabledMetricIds}
    onchange={ids => update({ enabledMetricIds: ids })}
    onrenameInstance={(id, label) => engine.updateMetricInstanceLabel(id, label)}
    oncreateInstance={(baseId, params, label, windowing, replacingId, projection) => {
      const newId = engine.addMetricInstance(baseId, params, label, windowing, projection)
      if (newId < 0) return
      if (replacingId != null) {
        engine.deleteMetricInstance(replacingId)
        update({ enabledMetricIds: settings.enabledMetricIds.map(id => id === replacingId ? newId : id) })
      } else {
        update({ enabledMetricIds: [...settings.enabledMetricIds, newId] })
      }
    }}
    ondeleteInstance={id => {
      engine.deleteMetricInstance(id)
      update({ enabledMetricIds: settings.enabledMetricIds.filter(x => x !== id) })
    }}
  />
  <Radio
    ariaLabel="View"
    options={METRIC_CORRELATION_VIEWS.map(v => ({
      label: v.label,
      value: v.value,
    }))}
    appearance="compact"
    direction="row"
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

<PaneSection title="Time range [ms]">
  <div class="time-range">
    <InputNumber
      id="timeline-start"
      label="Start"
      value={settings.timelineStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineStart: v })}
    />
    <InputNumber
      id="timeline-end"
      label="End (0 = Auto)"
      value={settings.timelineEnd}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineEnd: v })}
    />
  </div>
</PaneSection>

<style>
  .time-range {
    display: flex;
    gap: 8px;
  }
</style>
