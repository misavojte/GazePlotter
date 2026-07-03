<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select } from '$lib/shared/components'
  import {
    createBulkContext,
    StimulusColorRange,
    ColorScalePickerControl,
  } from '$lib/plots/shared/components/sections'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import type {
    ScanpathSimilarityItem,
    ScanpathSimilaritySettings,
    ScanpathSimilarityView,
  } from '../../types'

  let { item }: { item: ScanpathSimilarityItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<ScanpathSimilaritySettings>(() => item)

  const view = $derived(bulk.common(s => s.view ?? 'matrix'))
  // View-gated sub-controls are hidden while view diverges.
  const isScangraph = $derived(!view.mixed && view.value === 'scangraph')
  const isMatrix = $derived(!view.mixed && view.value === 'matrix')
  const visSummary = $derived(
    view.mixed ? 'Mixed' : view.value === 'matrix' ? 'Matrix' : 'ScanGraph'
  )

  const threshold = $derived(bulk.common(s => s.threshold ?? 0.5))
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  <Select
    options={[
      { label: 'Matrix', value: 'matrix' },
      { label: 'ScanGraph', value: 'scangraph' },
    ]}
    value={view.value}
    mixed={view.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as ScanpathSimilarityView
      bulk.update({ view: v })
    }}
  />

  {#if isScangraph}
    <InputNumber
      id="scanpath-threshold"
      label="Similarity threshold (0–1)"
      value={threshold.value}
      mixed={threshold.mixed}
      min={0}
      max={1}
      step={0.01}
      appearance="compact"
      onValueChange={v => bulk.update({ threshold: v ?? 0.5 })}
    />
  {/if}

  {#if isMatrix}
    <StimulusColorRange {bulk} idPrefix="scanpath-val" inputMax={1} step={0.01} />
  {/if}
  <ColorScalePickerControl
    {bulk}
    show={isMatrix}
    colorScale={settings.colorScale}
    defaultMin={PRESET_PALETTES.BLUE.colors[0]}
    defaultMax={PRESET_PALETTES.BLUE.colors[2]}
  />
</PaneSection>
