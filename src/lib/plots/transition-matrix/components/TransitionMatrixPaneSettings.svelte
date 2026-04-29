<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, InputCheck, InputColor } from '$lib/shared/components'
  import { buildValueRangePatch } from '$lib/plots/shared'
  import {
    ColorScalePicker,
    CommonPlotPaneFields,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type {
    TransitionMatrixPlotItem,
    TransitionMatrixPlotSettings,
  } from '../types'
  import { transitionMatrixDefinition } from '../definition'

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<TransitionMatrixPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const range = $derived<[number, number]>(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

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
  <CommonPlotPaneFields {item} contract={transitionMatrixDefinition.consumesMetrics!} />
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
  <ColorScalePicker
    colorScale={settings.colorScale}
    defaultMin={'#f7fbff'}
    defaultMax={'#08306b'}
    onCommit={patch => update({ colorScale: patch })}
  />
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
