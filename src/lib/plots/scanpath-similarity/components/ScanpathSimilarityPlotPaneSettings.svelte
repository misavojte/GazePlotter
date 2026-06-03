<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select } from '$lib/shared/components'
  import { buildValueRangePatch } from '$lib/plots/shared'
  import {
    ColorScalePicker,
    TimelineRangeSection,
    AoiPaneSection,
    StimulusPaneSection,
    ParticipantGroupPaneSection,
    MetricPaneSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import type {
    ScanpathSimilarityItem,
    ScanpathSimilaritySettings,
    ScanpathSimilarityView,
  } from '../types'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<ScanpathSimilaritySettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const view = $derived(settings.view ?? 'matrix')
  const isScangraph = $derived(view === 'scangraph')
  const visSummary = $derived(view === 'matrix' ? 'Matrix' : 'ScanGraph')

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
/>

<PaneSection title="Visualisation" summary={visSummary}>
  <Select
    options={[
      { label: 'Matrix', value: 'matrix' },
      { label: 'ScanGraph', value: 'scangraph' },
    ]}
    value={view}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as ScanpathSimilarityView
      update({ view: v })
    }}
  />

  {#if isScangraph}
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
  {/if}

  <!-- Picker stays mounted regardless of view — toggling via an
       outer `{#if}` broke the bindable plumbing in practice (the picker
       remounted with stale bindings on re-entry and its writes never
       reached parent state, so the colorScale commit never fired). Hide
       visually when not matrix, but keep the component instance alive
       so the `bind:` bindings never tear down mid-edit. -->
  <div style:display={isScangraph ? 'none' : 'contents'}>
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
    <ColorScalePicker
      colorScale={settings.colorScale}
      defaultMin={PRESET_PALETTES.BLUE.colors[0]}
      defaultMax={PRESET_PALETTES.BLUE.colors[2]}
      onCommit={patch => update({ colorScale: patch })}
    />
  </div>
</PaneSection>

<TimelineRangeSection {item} />

<AoiPaneSection stimulusId={settings.stimulusId} {source} />



<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
