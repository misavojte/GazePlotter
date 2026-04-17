<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components'
  import { getAois } from '$lib/data/engine'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    METRIC_CORRELATION_METHODS,
    METRIC_CORRELATION_VIEWS,
    WHOLE_STIMULUS_AOI_LABEL,
  } from '../const'
  import type {
    MetricCorrelationItem,
    MetricCorrelationSettings,
  } from '../types'
  import {
    createSystemMetricInstances,
    type MetricInstance,
  } from '$lib/plots/metrics'
  import MetricInstancePicker from './MetricInstancePicker.svelte'

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

  const WHOLE_STIMULUS_SENTINEL = '__whole_stimulus__'

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const aoiOptions = $derived.by<SelectOption[]>(() => {
    try {
      return getAois(engine, settings.stimulusId).map(a => ({
        label: a.displayedName,
        value: String(a.id),
      }))
    } catch {
      return []
    }
  })

  const scopeOptions = $derived<SelectOption[]>([
    { label: WHOLE_STIMULUS_AOI_LABEL, value: WHOLE_STIMULUS_SENTINEL },
    ...aoiOptions,
  ])

  const scopeValue = $derived(
    settings.selectedAoiId == null
      ? WHOLE_STIMULUS_SENTINEL
      : String(settings.selectedAoiId)
  )

  const library = $derived<readonly MetricInstance[]>(
    engine.metadata?.metricInstances && engine.metadata.metricInstances.length > 0
      ? engine.metadata.metricInstances
      : createSystemMetricInstances()
  )

  // Empty selection means "all system instances" — expand so the picker
  // shows the concrete list the user can manage.
  const effectiveIds = $derived(
    settings.enabledMetricIds.length > 0
      ? settings.enabledMetricIds
      : library.filter(i => i.system).map(i => i.id)
  )

  function onrenameInstance(id: number, label: string) {
    engine.updateMetricInstanceLabel(id, label)
  }
</script>

<PaneSection title="Filters" alwaysOpen>
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

<PaneSection title="Scope">
  <Select
    label="AOI / stimulus"
    options={scopeOptions}
    value={scopeValue}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail
      update({ selectedAoiId: v === WHOLE_STIMULUS_SENTINEL ? null : Number(v) })
    }}
  />
</PaneSection>

<PaneSection title="View">
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

<PaneSection title="Metrics">
  <MetricInstancePicker
    instances={library}
    selectedIds={effectiveIds}
    onchange={ids => update({ enabledMetricIds: ids })}
    {onrenameInstance}
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

<PaneSection title="Time range [ms]" defaultOpen={false}>
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
