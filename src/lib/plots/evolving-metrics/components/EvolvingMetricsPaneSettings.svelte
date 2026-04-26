<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import { ColorGradientPicker } from '$lib/color'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    getColorScaleCommitted,
    buildColorScalePatch,
    singleSelectMetricHandlers,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { MetricSelect } from '$lib/metrics'
  import { evolvingMetricsDefinition } from '../definition'
  import type { EvolvingMetricsItem, EvolvingMetricsSettings } from '../types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<EvolvingMetricsSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const presentation = $derived(settings.presentation ?? 'heatmap')
  const isHeatmap = $derived(presentation === 'heatmap')

  const colorFields = $derived(
    getColorScaleCommitted(
      settings.colorScale,
      PRESET_PALETTES.HEAT.colors[0],
      PRESET_PALETTES.HEAT.colors[2]
    )
  )

  let colorMin = $state(colorFields.colorMin)
  let colorMiddle = $state(colorFields.colorMiddle)
  let colorMax = $state(colorFields.colorMax)

  $effect(() => {
    colorMin = colorFields.colorMin
    colorMiddle = colorFields.colorMiddle
    colorMax = colorFields.colorMax
  })
  $effect(() => {
    const patch = buildColorScalePatch(
      { colorMin, colorMiddle, colorMax },
      colorFields
    )
    if (patch) update({ colorScale: patch })
  })

  const metricHandlers = $derived(singleSelectMetricHandlers(
    engine,
    () => settings.selectedMetricId,
    id => update({ selectedMetricId: id }),
  ))
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
    contract={evolvingMetricsDefinition.consumesMetrics!}
    instances={engine.metadata?.metricInstances ?? []}
    selectedIds={settings.selectedMetricId !== null ? [settings.selectedMetricId] : []}
    {...metricHandlers}
  />
  <Select
    label="Visualisation lense"
    options={[
      { label: 'Heatmap', value: 'heatmap' },
      { label: 'Overlay', value: 'overlay' },
    ]}
    value={presentation}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as 'heatmap' | 'overlay'
      update({ presentation: v })
    }}
  />
</PaneSection>

<PaneSection title="Time range [ms]">
  <div class="inline-pair">
    <InputNumber
      id="ev-timeline-start"
      label="Start"
      value={settings.timelineStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineStart: v })}
    />
    <InputNumber
      id="ev-timeline-end"
      label="End (0 = Auto)"
      value={settings.timelineEnd}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v => update({ timelineEnd: v })}
    />
  </div>
</PaneSection>

<div style:display={isHeatmap ? 'contents' : 'none'}>
  <PaneSection title="Colors">
    <ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />
  </PaneSection>
</div>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
