<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    singleSelectMetricHandlers,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { BarPlotItem, BarPlotSettings } from '../types'
  import { barPlotDefinition } from '../definition'
  import { MetricSelect } from '$lib/metrics'

  interface Props {
    item: BarPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<BarPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const metricHandlers = $derived(singleSelectMetricHandlers(
    engine,
    () => settings.metricInstanceId,
    id => update({ metricInstanceId: id }),
  ))

  const minScale = $derived(settings.scaleRange?.[0] ?? 0)
  const maxScale = $derived(settings.scaleRange?.[1] ?? 0)

  function updateScale(patch: { min?: number; max?: number }) {
    const next: [number, number] = [
      patch.min ?? minScale,
      patch.max ?? maxScale,
    ]
    update({ scaleRange: next })
  }
</script>

<PaneSection>
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
  <MetricSelect
    label="Metric"
    instances={engine.metadata?.metricInstances ?? []}
    selectedIds={settings.metricInstanceId == null ? [] : [settings.metricInstanceId]}
    {...metricHandlers}
    contract={barPlotDefinition.consumesMetrics!}
  />
</PaneSection>

<PaneSection title="Layout">
  <Radio
    legend="Statistical overlay"
    options={[
      { label: 'None', value: 'none' },
      { label: 'Mean ± 95% CI', value: 'meanCi95' },
      { label: 'Mean ± SD', value: 'meanSd' },
      { label: 'Boxplot', value: 'boxplot' },
    ]}
    appearance="compact"
    value={settings.statisticalOverlay}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['statisticalOverlay']
      update({ statisticalOverlay: v })
    }}
  />
  <Radio
    legend="Orientation"
    options={[
      { label: 'Horizontal', value: 'horizontal' },
      { label: 'Vertical', value: 'vertical' },
    ]}
    appearance="compact"
    direction="row"
    value={settings.barPlottingType}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['barPlottingType']
      update({ barPlottingType: v })
    }}
  />
  <Radio
    legend="Order by"
    options={[
      { label: 'Value', value: 'value' },
      { label: 'AOI order', value: 'aoi' },
    ]}
    appearance="compact"
    direction="row"
    value={settings.orderBy}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['orderBy']
      update({ orderBy: v })
    }}
  />
  <Radio
    legend="Direction"
    options={[
      { label: 'ASC', value: 'asc' },
      { label: 'DESC', value: 'desc' },
    ]}
    appearance="compact"
    direction="row"
    value={settings.orderDirection}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['orderDirection']
      update({ orderDirection: v })
    }}
  />
</PaneSection>

<PaneSection title="Scale range">
  <div class="inline-pair">
    <InputNumber
      id="bar-min-scale"
      label="Min"
      value={minScale}
      min={0}
      appearance="compact"
      onValueChange={v => updateScale({ min: v ?? 0 })}
    />
    <InputNumber
      id="bar-max-scale"
      label="Max (0 = Auto)"
      value={maxScale}
      min={0}
      appearance="compact"
      onValueChange={v => updateScale({ max: v ?? 0 })}
    />
  </div>
</PaneSection>

<PaneSection title="Time range [ms]">
  <div class="inline-pair">
    <InputNumber
      id="bar-timeline-start"
      label="Start"
      value={settings.timelineStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineStart: v })}
    />
    <InputNumber
      id="bar-timeline-end"
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
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
