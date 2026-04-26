<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select, InputCheck, InputColor } from '$lib/shared/components'
  import { ColorGradientPicker } from '$lib/color'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    getColorScaleCommitted,
    buildColorScalePatch,
    buildValueRangePatch,
    singleSelectMetricHandlers,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type {
    TransitionMatrixPlotItem,
    TransitionMatrixPlotSettings,
  } from '../types'
  import { MetricSelect } from '$lib/metrics'
  import { transitionMatrixDefinition } from '../definition'

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<TransitionMatrixPlotSettings>) {
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

  const colorFields = $derived(
    getColorScaleCommitted(settings.colorScale, '#f7fbff', '#08306b')
  )

  const range = $derived<[number, number]>(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
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
    const draft = { colorMin, colorMiddle, colorMax }
    const patch = buildColorScalePatch(draft, colorFields)
    if (patch) update({ colorScale: patch })
  })

  function updateValueRange(next: { min?: number; max?: number }) {
    const draft = {
      minValue: next.min ?? range[0],
      maxValue: next.max ?? range[1],
    }
    const committed = { minValue: range[0], maxValue: range[1] }
    const patch = buildValueRangePatch(
      draft,
      committed,
      settings.stimuliColorValueRanges,
      settings.stimulusId
    )
    if (patch) update({ stimuliColorValueRanges: patch })
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
    contract={transitionMatrixDefinition.consumesMetrics!}
  />
</PaneSection>

<PaneSection title="Color scale">
  <div class="inline-pair">
    <InputNumber
      id="tm-min-val"
      label="Min"
      value={range[0]}
      min={0}
      appearance="compact"
      onValueChange={v => updateValueRange({ min: v ?? 0 })}
    />
    <InputNumber
      id="tm-max-val"
      label="Max (0 = Auto)"
      value={range[1]}
      min={0}
      appearance="compact"
      onValueChange={v => updateValueRange({ max: v ?? 0 })}
    />
  </div>
  <ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />
</PaneSection>

<PaneSection title="Out of bounds">
  <div class="inline-pair">
    <InputColor
      label="Below min"
      size="xs"
      value={settings.belowMinColor}
      oninput={(e: CustomEvent<string>) => update({ belowMinColor: e.detail })}
      width={40}
    />
    <div class="oob-check">
      <InputCheck
        label="Show text"
        appearance="compact"
        size="xs"
        checked={settings.showBelowMinLabels}
        onchange={e => update({ showBelowMinLabels: (e as CustomEvent<boolean>).detail })}
      />
    </div>
  </div>
  <div class="inline-pair">
    <InputColor
      label="Above max"
      size="xs"
      value={settings.aboveMaxColor}
      oninput={(e: CustomEvent<string>) => update({ aboveMaxColor: e.detail })}
      width={40}
    />
    <div class="oob-check">
      <InputCheck
        label="Show text"
        appearance="compact"
        size="xs"
        checked={settings.showAboveMaxLabels}
        onchange={e => update({ showAboveMaxLabels: (e as CustomEvent<boolean>).detail })}
      />
    </div>
  </div>
</PaneSection>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .oob-check {
    padding-bottom: 2px;
  }
</style>
