<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, InputNumber, Radio, Select } from '$lib/shared/components'
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
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { SIMILARITY_METHODS } from '../const'
  import type {
    ScanpathSimilarityItem,
    ScanpathSimilaritySettings,
    SimilarityMethod,
    ScanpathSimilarityView,
  } from '../types'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<ScanpathSimilaritySettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, settings.stimulusId)
  )

  const view = $derived(settings.view ?? 'matrix')
  const isScangraph = $derived(view === 'scangraph')

  const colorFields = $derived(
    getColorScaleCommitted(
      settings.colorScale,
      PRESET_PALETTES.BLUE.colors[0],
      PRESET_PALETTES.BLUE.colors[2]
    )
  )

  const range = $derived<[number, number]>(
    settings.stimuliColorValueRanges?.[settings.stimulusId] ?? [0, 0]
  )

  let colorMin = $state(colorFields.colorMin)
  let colorMiddle = $state(colorFields.colorMiddle)
  let colorMax = $state(colorFields.colorMax)

  // External -> local sync + local -> committed. buildColorScalePatch
  // returns null when draft matches committed, so the round-trip
  // self-terminates — no microtask-gated flag needed.
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
  <Radio
    ariaLabel="View"
    options={[
      { label: 'Matrix', value: 'matrix' },
      { label: 'ScanGraph', value: 'scangraph' },
    ]}
    appearance="compact"
    direction="row"
    value={view}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as ScanpathSimilarityView
      update({ view: v })
    }}
  />
</PaneSection>

<PaneSection title="Method">
  <Radio
    ariaLabel="Similarity method"
    options={[...SIMILARITY_METHODS]}
    appearance="compact"
    value={settings.similarityMethod ?? 'levenshtein'}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as SimilarityMethod
      update({ similarityMethod: v })
    }}
  />
  <InputCheck
    label="Collapse consecutive AOIs"
    appearance="compact"
    size="xs"
    checked={settings.collapsed ?? false}
    onchange={e => update({ collapsed: (e as CustomEvent<boolean>).detail })}
  />
</PaneSection>

{#if isScangraph}
  <PaneSection title="Graph threshold">
    <InputNumber
      id="scanpath-threshold"
      label="Similarity threshold (0–1)"
      value={settings.threshold ?? 0.5}
      min={0}
      max={1}
      step={0.01}
      appearance="compact"
      onValueChange={v => update({ threshold: v ?? 0.5 })}
    />
  </PaneSection>
{/if}

<!-- Picker stays mounted regardless of view — toggling via an
     outer `{#if}` broke the bindable plumbing in practice (the picker
     remounted with stale bindings on re-entry and its writes never
     reached parent state, so the colorScale commit never fired). Hide
     visually when not matrix, but keep the component instance alive
     so the `bind:` bindings never tear down mid-edit. -->
<div style:display={isScangraph ? 'none' : 'contents'}>
  <PaneSection title="Color scale">
    <div class="inline-pair">
      <InputNumber
        id="scanpath-min-val"
        label="Min"
        value={range[0]}
        min={0}
        max={1}
        step={0.01}
        appearance="compact"
        onValueChange={v => updateValueRange({ min: v ?? 0 })}
      />
      <InputNumber
        id="scanpath-max-val"
        label="Max (0 = Auto)"
        value={range[1]}
        min={0}
        max={1}
        step={0.01}
        appearance="compact"
        onValueChange={v => updateValueRange({ max: v ?? 0 })}
      />
    </div>
    <ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />
  </PaneSection>
</div>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
