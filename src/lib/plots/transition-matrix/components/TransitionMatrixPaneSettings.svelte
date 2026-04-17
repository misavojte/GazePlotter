<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select } from '$lib/shared/components'
  import { ColorGradientPicker } from '$lib/color'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
    getColorScaleCommitted,
    buildColorScalePatch,
    buildValueRangePatch,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { MatrixAggregationMethod } from '../const'
  import type {
    TransitionMatrixPlotItem,
    TransitionMatrixPlotSettings,
  } from '../types'

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

  const AGGREGATION_OPTIONS = [
    { value: MatrixAggregationMethod.SUM, label: 'Absolute frequency' },
    { value: MatrixAggregationMethod.FREQUENCY_RELATIVE, label: 'Relative frequency' },
    { value: MatrixAggregationMethod.PROBABILITY, label: '1-step probability' },
    { value: MatrixAggregationMethod.PROBABILITY_2, label: '2-step probability' },
    { value: MatrixAggregationMethod.PROBABILITY_3, label: '3-step probability' },
    { value: MatrixAggregationMethod.DWELL_TIME, label: 'Fixation duration' },
    { value: MatrixAggregationMethod.SEGMENT_DWELL_TIME, label: 'Dwell duration' },
  ]

  const colorFields = $derived(
    getColorScaleCommitted(settings.colorScale, '#f7fbff', '#08306b')
  )

  const range = $derived<[number, number]>(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  let colorMin = $state(colorFields.colorMin)
  let colorMiddle = $state(colorFields.colorMiddle)
  let colorMax = $state(colorFields.colorMax)

  // External -> local sync: whenever the committed settings change, resync
  // the picker. Guarded to avoid clobbering in-flight local edits.
  let syncingFromProps = false
  $effect(() => {
    syncingFromProps = true
    colorMin = colorFields.colorMin
    colorMiddle = colorFields.colorMiddle
    colorMax = colorFields.colorMax
    queueMicrotask(() => (syncingFromProps = false))
  })

  // Local -> committed: every user-driven change commits a patch.
  $effect(() => {
    const draft = { colorMin, colorMiddle, colorMax }
    if (syncingFromProps) return
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

<PaneSection title="Aggregation">
  <Select
    label="Method"
    options={AGGREGATION_OPTIONS}
    value={settings.aggregationMethod}
    onchange={e => update({ aggregationMethod: (e as CustomEvent<string>).detail })}
  />
</PaneSection>

<PaneSection title="Scale range">
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
</PaneSection>

<PaneSection title="Colors">
  <ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />
</PaneSection>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
